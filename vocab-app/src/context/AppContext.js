// 全局应用状态：当前词本、音频预下载进度
// 使用 useReducer 管理状态，通过 Context 向下层组件提供状态与动作。
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
} from 'react';
import { AVAILABLE_BOOKS } from '../config';

export const AppContext = createContext(null);

// 初始状态
const initialState = {
  // 当前选中的词本标签，默认不选中（HomeScreen 展示空状态提示选择）
  currentBookTag: null,
  // 是否正在批量预下载音频
  isAudioPreloading: false,
  // 预下载进度
  preloadProgress: { completed: 0, total: 0 },
};

/**
 * reducer: 处理所有全局状态变更
 * - SELECT_BOOK       : 切换词本
 * - PRELOAD_START     : 开始预下载（重置进度为 0）
 * - PRELOAD_PROGRESS  : 更新预下载进度
 * - PRELOAD_END       : 预下载结束
 */
function reducer(state, action) {
  switch (action.type) {
    case 'SELECT_BOOK':
      // tag 相同则返回原 state（引用不变，React 会跳过重渲染）
      if (action.tag === state.currentBookTag) return state;
      return { ...state, currentBookTag: action.tag };

    case 'PRELOAD_START':
      return {
        ...state,
        isAudioPreloading: true,
        preloadProgress: { completed: 0, total: 0 },
      };

    case 'PRELOAD_PROGRESS':
      return {
        ...state,
        preloadProgress: { completed: action.completed, total: action.total },
      };

    case 'PRELOAD_END':
      return { ...state, isAudioPreloading: false };

    default:
      return state;
  }
}

/**
 * 应用状态 Provider，包裹根组件
 * @param {{children: React.ReactNode}} props
 */
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  /**
   * 切换当前词本；tag 相同则不重复 dispatch
   * @param {string} tag
   */
  const selectBook = useCallback(
    (tag) => {
      // 相同词本不做无意义的重新派发
      if (tag === state.currentBookTag) return;
      dispatch({ type: 'SELECT_BOOK', tag });
    },
    [state.currentBookTag]
  );

  /** 开始批量预下载音频 */
  const startPreload = useCallback(() => {
    dispatch({ type: 'PRELOAD_START' });
  }, []);

  /** 更新预下载进度 */
  const updatePreload = useCallback((completed, total) => {
    dispatch({ type: 'PRELOAD_PROGRESS', completed, total });
  }, []);

  /** 结束预下载 */
  const finishPreload = useCallback(() => {
    dispatch({ type: 'PRELOAD_END' });
  }, []);

  // 用 useMemo 缓存 context 值，避免不必要的重新渲染
  const value = useMemo(
    () => ({
      state,
      availableBooks: AVAILABLE_BOOKS,
      selectBook,
      startPreload,
      updatePreload,
      finishPreload,
    }),
    [state, selectBook, startPreload, updatePreload, finishPreload]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/**
 * 在组件中读取全局状态与动作
 * @returns {{state: object, availableBooks: string[], selectBook: Function, startPreload: Function, updatePreload: Function, finishPreload: Function}}
 */
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp 必须在 <AppProvider> 内部使用');
  }
  return ctx;
}
