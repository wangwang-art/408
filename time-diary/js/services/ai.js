/* 服务层：AI 洞察（预留接口，默认关闭，当前无任何网络行为）
 *
 * 约定：AI 分析与规则版洞察可无缝互换 ——
 *   规则版：Domain.stats.insights(summary, opts) → string[]
 *   AI 版： TD.AI.analyze(summary)             → Promise<string[]>
 * 两者入参同为 Domain.stats.summarize() 的返回值（仅聚合统计）。
 *
 * 未来启用步骤：
 *   1. Config.AI.enabled 置 true，填 endpoint（OpenAI 兼容 /chat/completions）与 model；
 *      apiKey 建议运行时从设置读取，严禁提交真实密钥入库
 *   2. 实现 analyze()：POST endpoint，body 含 buildContext(summary) 的聚合 JSON
 *      + system 提示词（输出 3~5 条一句话洞察）
 *   3. stats 页把 Domain.stats.insights(...) 的调用替换为 await TD.AI.analyze(summary)
 *      （失败时建议回退规则版，保证洞察卡永远有内容）
 *
 * 隐私红线：只允许发送聚合统计（buildContext 的产物），绝不发送原始记录明细。 */
(function (root) {
  'use strict';
  root.TD = root.TD || {};

  root.TD.AI = {
    /** 是否已启用（预留：默认 false，恒为未启用） */
    enabled: function () {
      var ai = root.TD.Config.AI;
      return !!(ai && ai.enabled && ai.endpoint);
    },

    /** AI 洞察分析（预留，未实现——调用必被拒绝并由调用方回退规则版）
     * @param {{total:number, items:Array}} summary Domain.stats.summarize() 的返回值
     * @returns {Promise<string[]>} 洞察文案数组，每条一句话
     */
    analyze: function (summary) {
      if (!this.enabled()) {
        return Promise.reject(new Error('AI 分析未启用'));
      }
      return Promise.reject(new Error('AI 分析尚未实现（预留接口）'));
    },

    /** 组装 AI 上下文（预留）：仅聚合统计，四舍五入去噪，供实现时直接作 prompt 载荷 */
    buildContext: function (summary) {
      return JSON.stringify({
        totalMinutes: Math.round(summary.total),
        items: (summary.items || []).map(function (x) {
          return { name: x.name, minutes: Math.round(x.minutes), ratio: Math.round(x.ratio * 100) / 100 };
        })
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
