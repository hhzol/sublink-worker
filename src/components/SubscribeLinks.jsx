/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

export const SubscribeLinks = (props) => {
    const { t, links } = props;

    if (!links) return null;

    return (
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8 transition-all duration-300 hover:shadow-md">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                <span class="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                    <i class="fas fa-link text-sm"></i>
                </span>
                {t('subscriptionLinks')}
            </h2>

            <div class="space-y-4">
                {/* Xray Link */}
                <div class="relative group">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('xrayLink')}
                    </label>
                    <div class="flex gap-2">
                        <input
                            type="text"
                            readonly
                            value={links.xray}
                            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 font-mono text-sm"
                            data-copy-input="xray"
                        />
                        <button
                            type="button"
                            class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 transition-colors duration-200"
                            data-copy-btn="xray"
                        >
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>

                {/* SingBox Link */}
                <div class="relative group">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('singboxLink')}
                    </label>
                    <div class="flex gap-2">
                        <input
                            type="text"
                            readonly
                            value={links.singbox}
                            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 font-mono text-sm"
                            data-copy-input="singbox"
                        />
                        <button
                            type="button"
                            class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 transition-colors duration-200"
                            data-copy-btn="singbox"
                        >
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>

                {/* Clash Link */}
                <div class="relative group">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('clashLink')}
                    </label>
                    <div class="flex gap-2">
                        <input
                            type="text"
                            readonly
                            value={links.clash}
                            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 font-mono text-sm"
                            data-copy-input="clash"
                        />
                        <button
                            type="button"
                            class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 transition-colors duration-200"
                            data-copy-btn="clash"
                        >
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>

                {/* Surge Link */}
                <div class="relative group">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('surgeLink')}
                    </label>
                    <div class="flex gap-2">
                        <input
                            type="text"
                            readonly
                            value={links.surge}
                            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 font-mono text-sm"
                            data-copy-input="surge"
                        />
                        <button
                            type="button"
                            class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 transition-colors duration-200"
                            data-copy-btn="surge"
                        >
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* 原生 JavaScript 实现复制功能 */}
            <script
                dangerouslySetInnerHTML={{
                    __html: `
                        (function() {
                            document.addEventListener('DOMContentLoaded', function() {
                                const buttons = document.querySelectorAll('[data-copy-btn]');
                                buttons.forEach(btn => {
                                    btn.addEventListener('click', function(e) {
                                        const key = this.dataset.copyBtn;
                                        const input = document.querySelector('[data-copy-input="' + key + '"]');
                                        if (!input) return;
                                        const text = input.value;
                                        
                                        const copySuccess = function() {
                                            const icon = this.querySelector('i');
                                            if (icon) {
                                                icon.className = 'fas fa-check';
                                                setTimeout(() => {
                                                    icon.className = 'fas fa-copy';
                                                }, 2000);
                                            }
                                        }.bind(this);
                                        
                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                            navigator.clipboard.writeText(text).then(copySuccess).catch(err => {
                                                console.error('复制失败:', err);
                                                // 降级方案
                                                input.select();
                                                document.execCommand('copy');
                                                copySuccess();
                                            });
                                        } else {
                                            // 老旧浏览器降级方案
                                            input.select();
                                            document.execCommand('copy');
                                            copySuccess();
                                        }
                                    });
                                });
                            });
                        })();
                    `
                }}
            />
        </div>
    );
};