import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { UserRole } from '@/utils/constants'
import { isDingTalkEnv, performLogin } from '@/utils/dingtalk'

export interface UserInfo {
  userid: string
  unionid?: string
  name: string
  role: UserRole
  avatar?: string
  mobile?: string
  title?: string
  dept_id_list?: number[]
}

/** 角色映射：根据用户职位/部门自动分配角色 */
function mapRoleFromUser(user: {
  title?: string
  dept_id_list?: number[]
}): UserRole {
  // 可以根据实际组织架构调整映射规则
  // 示例：根据职位关键字匹配角色
  const title = (user.title || '').toLowerCase()

  if (title.includes('质量安全') || title.includes('安全')) {
    return UserRole.SAFETY
  }
  if (title.includes('分管') || title.includes('副总') || title.includes('总工程师')) {
    return UserRole.LEADER
  }
  if (title.includes('主任') || title.includes('所长')) {
    return UserRole.DEPT_HEAD
  }

  // 默认为项目负责人
  return UserRole.PROJECT_MANAGER
}

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo | null>(null)
  const isLoggedIn = ref(false)
  const loginLoading = ref(false)
  const loginError = ref<string | null>(null)

  // 角色判断
  const isAdmin = computed(() => userInfo.value?.role === UserRole.ADMIN)
  const isSafety = computed(() => userInfo.value?.role === UserRole.SAFETY)
  const isLeader = computed(() => userInfo.value?.role === UserRole.LEADER)
  const isDeptHead = computed(() => userInfo.value?.role === UserRole.DEPT_HEAD)
  const isProjectManager = computed(() => userInfo.value?.role === UserRole.PROJECT_MANAGER)

  /**
   * 登录流程
   * 钉钉环境：JSAPI获取authCode → 服务端换取用户信息 → 自动分配角色
   * 非钉钉环境：使用开发模式模拟登录
   */
  async function login() {
    loginLoading.value = true
    loginError.value = null

    try {
      if (isDingTalkEnv()) {
        // 钉钉环境：真实OAuth登录
        const dingUser = await performLogin()

        if (dingUser) {
          userInfo.value = {
            userid: dingUser.userid,
            unionid: dingUser.unionid,
            name: dingUser.name,
            role: mapRoleFromUser(dingUser),
            avatar: dingUser.avatar,
            mobile: dingUser.mobile,
            title: dingUser.title,
            dept_id_list: dingUser.dept_id_list,
          }
          isLoggedIn.value = true

          // 持久化用户信息到 sessionStorage
          sessionStorage.setItem('dt_user', JSON.stringify(userInfo.value))
          return
        }

        // OAuth失败，尝试从缓存恢复
        const cached = sessionStorage.getItem('dt_user')
        if (cached) {
          try {
            userInfo.value = JSON.parse(cached)
            isLoggedIn.value = true
            return
          } catch {
            // 缓存失效，降级到模拟模式
          }
        }
      }

      // 非钉钉环境或登录失败：使用模拟模式
      useDevLogin()
    } catch (e) {
      console.error('[User] 登录异常:', e)
      loginError.value = '登录失败，已切换到模拟模式'
      useDevLogin()
    } finally {
      loginLoading.value = false
    }
  }

  /** 开发模式模拟登录 */
  function useDevLogin() {
    // 检查是否有缓存的角色偏好
    const savedRole = localStorage.getItem('dt_dev_role') as UserRole | null

    userInfo.value = {
      userid: savedRole ? `dev_${savedRole}` : 'dev_admin',
      name: savedRole ? getRoleName(savedRole) : '开发管理员',
      role: savedRole || UserRole.ADMIN,
    }
    isLoggedIn.value = true
  }

  /** 设置模拟角色（开发调试用） */
  function setMockRole(role: UserRole) {
    userInfo.value = {
      userid: `dev_${role}`,
      name: getRoleName(role),
      role,
    }

    // 记住角色偏好
    localStorage.setItem('dt_dev_role', role)
  }

  /** 退出登录 */
  function logout() {
    userInfo.value = null
    isLoggedIn.value = false
    sessionStorage.removeItem('dt_user')
  }

  return {
    userInfo,
    isLoggedIn,
    loginLoading,
    loginError,
    isAdmin,
    isSafety,
    isLeader,
    isDeptHead,
    isProjectManager,
    login,
    setMockRole,
    logout,
  }
})

function getRoleName(role: UserRole): string {
  const names: Record<string, string> = {
    [UserRole.PROJECT_MANAGER]: '开发-项目负责人',
    [UserRole.DEPT_HEAD]: '开发-室所主任',
    [UserRole.LEADER]: '开发-分管领导',
    [UserRole.SAFETY]: '开发-质量安全人员',
    [UserRole.ADMIN]: '开发管理员',
  }
  return names[role] || '开发用户'
}
