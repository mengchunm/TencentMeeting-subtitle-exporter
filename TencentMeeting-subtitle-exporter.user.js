// ==UserScript==
// @name         腾讯会议字幕导出 
// @namespace    http://tampermonkey.net/
// @version      4.4
// @description  导出腾讯会议保存视频字幕保存导出为SRT格式
// @match        https://meeting.tencent.com/cw/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/mengchunm/TencentMeeting-subtitle-exporter/main/TencentMeeting-subtitle-exporter.user.js
// @updateURL    https://raw.githubusercontent.com/mengchunm/TencentMeeting-subtitle-exporter/main/TencentMeeting-subtitle-exporter.user.js
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // 填入字幕列表容器的 CSS 选择器
    const YOUR_SELECTOR = '.minutes-module-list';

    let finalSRTContent = '';
    let uiInjected = false;
    let appContext = null;
    const ui = {};

    // 注入导出控件
    function initializeUI(doc) {
        appContext = doc;
        const controlsContainer = doc.createElement('div');
        controlsContainer.id = 'srt-exporter-container';
        Object.assign(controlsContainer.style, {
            position: 'fixed', top: '120px', right: '20px', zIndex: '99999',
            backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px',
            padding: '12px', boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
            fontFamily: 'sans-serif', width: '160px', textAlign: 'center'
        });

        // 导出按钮
        ui.exportButton = doc.createElement('button');
        ui.exportButton.textContent = '导出SRT字幕';
        Object.assign(ui.exportButton.style, {
            display: 'block', width: '100%', padding: '10px',
            backgroundColor: '#007bff', color: 'white',
            borderRadius: '5px', cursor: 'pointer', fontSize: '14px', border: 'none'
        });
        ui.exportButton.onclick = exportSubtitlesToSRT;

        // 进度条
        ui.progressBarContainer = doc.createElement('div');
        ui.progressBarContainer.style.display = 'none';
        ui.progressBarContainer.style.marginTop = '10px';
        const progressBar = doc.createElement('div');
        Object.assign(progressBar.style, {
            width: '100%', height: '8px', backgroundColor: '#e9ecef',
            borderRadius: '4px', overflow: 'hidden'
        });
        ui.progressFill = doc.createElement('div');
        Object.assign(ui.progressFill.style, {
            width: '0%', height: '100%', backgroundColor: '#4caf50',
            transition: 'width 0.2s ease-in-out'
        });
        ui.progressText = doc.createElement('div');
        ui.progressText.textContent = '加载中...';
        Object.assign(ui.progressText.style, {
            fontSize: '12px', color: '#6c757d', marginTop: '5px'
        });
        progressBar.appendChild(ui.progressFill);
        ui.progressBarContainer.appendChild(ui.progressText);
        ui.progressBarContainer.appendChild(progressBar);

        // 下载按钮
        ui.downloadButton = doc.createElement('button');
        ui.downloadButton.textContent = '下载字幕';
        Object.assign(ui.downloadButton.style, {
            display: 'none', width: '100%', padding: '10px',
            backgroundColor: '#28a745', color: 'white',
            borderRadius: '5px', cursor: 'pointer', fontSize: '14px',
            marginTop: '10px', border: 'none'
        });
        ui.downloadButton.onclick = downloadSRTFile;

        controlsContainer.appendChild(ui.exportButton);
        controlsContainer.appendChild(ui.progressBarContainer);
        controlsContainer.appendChild(ui.downloadButton);
        doc.body.appendChild(controlsContainer);
        console.log('字幕导出控件已注入');
    }

    // 毫秒 → SRT 时间格式
    function formatSRTTime(ms) {
        const date = new Date(ms);
        return `${date.getUTCHours().toString().padStart(2, '0')}:` +
               `${date.getUTCMinutes().toString().padStart(2, '0')}:` +
               `${date.getUTCSeconds().toString().padStart(2, '0')},` +
               `${date.getUTCMilliseconds().toString().padStart(3, '0')}`;
    }

    // 解析字幕时间段
    function parseTimeOffset(timeOffset) {
        const [startMs, endMs] = timeOffset.split('-').map(t => parseInt(t));
        return { start: formatSRTTime(startMs), end: formatSRTTime(endMs) };
    }

    // 导出字幕内容
    function exportSubtitlesToSRT() {
        if (!appContext) return alert('脚本上下文丢失，请刷新页面！');

        ui.exportButton.disabled = true;
        ui.exportButton.textContent = '正在加载...';
        ui.progressBarContainer.style.display = 'block';
        ui.downloadButton.style.display = 'none';
        ui.progressFill.style.width = '0%';
        ui.progressText.textContent = '加载进度: 0%';

        const container = appContext.querySelector(YOUR_SELECTOR);
        if (!container) {
            alert('错误：未找到字幕容器');
            ui.exportButton.disabled = false;
            ui.exportButton.textContent = '导出SRT字幕';
            ui.progressBarContainer.style.display = 'none';
            return;
        }

        const allSubtitles = new Map();
        let lastScrollTop = -1; // 用于检测滚动是否卡住

        const processAndFinalize = () => {
            const finalSubtitles = Array.from(allSubtitles.values())
                .sort((a, b) => a.pid - b.pid || a.sid - b.sid);

            let srtContent = '';
            let seq = 1;
            finalSubtitles.forEach(s => {
                if (s.timeOffset && s.text.trim()) {
                    try {
                        const { start, end } = parseTimeOffset(s.timeOffset);
                        srtContent += `${seq++}\n${start} --> ${end}\n${s.text.trim()}\n\n`;
                    } catch (e) {
                        console.warn(`解析时间失败: ${s.timeOffset}`, e);
                    }
                }
            });

            if (!srtContent.trim()) {
                alert('未能生成SRT内容，请检查字幕数据');
                ui.exportButton.disabled = false;
                ui.exportButton.textContent = '导出SRT字幕';
                ui.exportButton.style.display = 'block';
                ui.progressBarContainer.style.display = 'none';
                return;
            }
            finalSRTContent = srtContent;

            ui.exportButton.style.display = 'none';
            ui.progressBarContainer.style.display = 'none';
            ui.downloadButton.style.display = 'block';
        };

        const loadContent = () => {
            const totalHeight = container.scrollHeight;
            const viewportHeight = container.clientHeight;

            // 提取当前可见的字幕
            appContext.querySelectorAll('[data-pid]').forEach(paragraph => {
                const pid = paragraph.getAttribute('data-pid');
                if (!pid) return;
                paragraph.querySelectorAll('[data-sid]').forEach(sentence => {
                    const sid = sentence.getAttribute('data-sid');
                    const timeOffset = sentence.getAttribute('data-time-offset');
                    if (sid && timeOffset) {
                        const words = sentence.querySelectorAll('[class*="word-module_word"]');
                        const text = Array.from(words).map(w => w.textContent.trim()).join('');
                        if (text) {
                            const key = `${pid}-${sid}`;
                            if (!allSubtitles.has(key)) {
                                allSubtitles.set(key, { pid: +pid, sid: +sid, text, timeOffset });
                            }
                        }
                    }
                });
            });

            // 更新进度条
            const progress = Math.min(((container.scrollTop + viewportHeight) / totalHeight) * 100, 100);
            ui.progressFill.style.width = `${progress.toFixed(1)}%`;
            ui.progressText.textContent = `加载进度: ${progress.toFixed(1)}%`;

            // 检查是否已滚动到底部 (增加5px的容差) 或滚动位置不再变化
            if ((container.scrollTop + viewportHeight + 5) >= totalHeight || container.scrollTop === lastScrollTop) {
                console.log('滚动完成。');
                processAndFinalize();
            } else {
                // 向下滚动并安排下一次内容提取
                lastScrollTop = container.scrollTop;
                container.scrollTop += viewportHeight; // 向下滚动一个视口的高度
                setTimeout(loadContent, 800); // 等待新内容加载
            }
        };

        // **核心修复**：确保从顶部开始
        // 先强制将滚动条置于顶部，然后等待一段时间让浏览器响应，最后再开始加载。
        console.log('正在重置滚动条到顶部...');
        container.scrollTop = 0;

        setTimeout(() => {
            console.log(`滚动条已重置, 当前位置: ${container.scrollTop}px. 开始加载字幕.`);
            // 确认滚动条在顶部后，开始递归加载内容
            loadContent();
        }, 500); // 增加延迟以确保滚动操作被浏览器处理
    }

    // 下载字幕文件
    function downloadSRTFile() {
        if (!finalSRTContent) return alert('没有可下载的SRT内容');
        const blob = new Blob(['\uFEFF' + finalSRTContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = appContext.createElement('a');
        a.href = url;
        a.download = `腾讯会议字幕_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.srt`;
        appContext.body.appendChild(a);
        a.click();
        appContext.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 检测字幕容器并注入UI
    function findTargetAndInject() {
        if (uiInjected || !YOUR_SELECTOR) return;
        let targetDoc = null;
        if (document.querySelector(YOUR_SELECTOR)) {
            targetDoc = document;
        } else {
            for (const iframe of document.querySelectorAll('iframe')) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc && iframeDoc.querySelector(YOUR_SELECTOR)) {
                        targetDoc = iframeDoc;
                        break;
                    }
                } catch (e) {}
            }
        }
        if (targetDoc) {
            uiInjected = true;
            observer.disconnect();
            initializeUI(targetDoc);
        }
    }

    const observer = new MutationObserver(findTargetAndInject);
    observer.observe(document.body, { childList: true, subtree: true });
    findTargetAndInject();
})();
