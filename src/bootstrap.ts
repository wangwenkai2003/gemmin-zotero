// src/bootstrap.ts

import { getPdfText, callGeminiAPI } from './gemini';

// 声明 Zotero 和 document 全局变量，以获得 TypeScript 提示
declare const Zotero: any;
declare const document: any;

// 插件的主类
class GeminiAnalyzer {
  private tabID: string = 'gemini-analyzer-tab';

  // Zotero 启动时调用
  startup({ id, version, rootURI }: { id: string; version: string; rootURI: string }) {
    Zotero.log(`Gemini PDF Analyzer: Starting version ${version}`);
    this.addTab();
  }

  // Zotero 关闭时调用
  shutdown() {
    Zotero.log('Gemini PDF Analyzer: Shutting down');
    this.removeTab();
  }

  private addTab() {
    const tab = document.createElement('tab');
    tab.id = this.tabID;
    tab.label = 'Gemini Q&A';

    const tabs = document.getElementById('zotero-item-pane-tabs');
    tabs.append(tab);

    const tabpanel = document.createElement('tabpanel');
    tabpanel.id = `${this.tabID}-panel`;
    tabpanel.setAttribute('flex', '1');

    // 注入 UI
    tabpanel.innerHTML = `
      <div style="padding: 10px; overflow-y: auto; height: 100%;">
          <h4>Gemini PDF Analyzer</h4>
          <div id="gemini-api-key-warning" style="color: red; display: none;">
              请先在 Zotero 设置中配置 Gemini API Key。
          </div>
          <textarea id="gemini-question-input" placeholder="在此输入你关于这篇文献的问题..." style="width: 95%; height: 80px; margin-top: 10px;"></textarea>
          <button id="gemini-ask-button" style="margin-top: 10px;">提问</button>
          <hr>
          <h5>回答:</h5>
          <div id="gemini-answer-output" style="white-space: pre-wrap; background-color: #f5f5f5; padding: 8px; border-radius: 4px; min-height: 100px;">
              请先提问...
          </div>
      </div>
    `;

    const tabpanels = document.getElementById('zotero-item-pane-content');
    tabpanels.append(tabpanel);

    const askButton = document.querySelector('#gemini-ask-button');
    askButton?.addEventListener('click', () => this.handleAskButtonClick());
  }

  private removeTab() {
    document.getElementById(this.tabID)?.remove();
    document.getElementById(`${this.tabID}-panel`)?.remove();
  }

  private async handleAskButtonClick() {
    const outputDiv = document.getElementById('gemini-answer-output');
    const questionInput = document.getElementById('gemini-question-input') as HTMLTextAreaElement;
    
    outputDiv.textContent = '正在分析文献并请求 Gemini...';
    
    const item = Zotero.getActiveZoteroPane().getSelectedItems()[0];
    if (!item) {
        outputDiv.textContent = '请选择一个文献条目。';
        return;
    }
    
    const apiKey = Zotero.Prefs.get('extensions.gemini-pdf-analyzer.apiKey');
    if (!apiKey) {
        outputDiv.textContent = '错误：未配置 Gemini API Key！';
        return;
    }

    try {
        const pdfText = await getPdfText(item);
        if (!pdfText) {
            outputDiv.textContent = '未能从此条目中提取到 PDF 文本。';
            return;
        }

        const question = questionInput.value;
        if (!question.trim()) {
            outputDiv.textContent = '请输入你的问题。';
            return;
        }
        
        const answer = await callGeminiAPI(apiKey, pdfText, question);
        outputDiv.textContent = answer;

    } catch (error: any) {
        Zotero.log(error, 'error');
        outputDiv.textContent = `发生错误: ${error.message}`;
    }
  }
}

// 实例化并暴露给 Zotero
(Zotero.getMainWindow() as any).ZoteroPlugin = new GeminiAnalyzer();
