// src/gemini.ts

// 告诉 TypeScript Zotero 对象是全局存在的，并提供基础的类型定义以获得更好的代码提示
declare const Zotero: {
    Items: {
      getAsync(ids: number[]): Promise<any[]>;
    };
    HTTP: {
      request(
        method: string,
        url: string,
        options: {
          body: string;
          headers: Record<string, string>;
        }
      ): Promise<{ text: string }>;
    };
    log(message: string | Error, level?: 'error' | 'warn' | 'info'): void;
  };
  
  /**
   * 从 Zotero 条目中提取第一个 PDF 附件的全文。
   * @param item Zotero.Item 对象，代表选中的文献条目。
   * @returns 返回一个包含 PDF 文本内容的 Promise，如果找不到或提取失败则返回 null。
   */
  export async function getPdfText(item: any): Promise<string | null> {
    // 获取条目下所有附件的 ID
    const attachmentIDs: number[] = item.getAttachments();
    if (!attachmentIDs.length) {
      Zotero.log('No attachments found for this item.');
      return null;
    }
  
    // 异步获取所有附件对象
    const attachments = await Zotero.Items.getAsync(attachmentIDs);
    
    // 从附件列表中找到第一个 PDF 文件
    const pdfAttachment = attachments.find(
      (attachment: any) => attachment.attachmentContentType === 'application/pdf'
    );
  
    if (!pdfAttachment) {
      Zotero.log('No PDF attachment found for this item.');
      return null;
    }
  
    // 使用 Zotero 7 的 API 异步提取全文
    try {
      // getFulltext() 返回一个包含 content 和 pages 的对象
      const textData = await pdfAttachment.getFulltext();
      if (textData && textData.content) {
        return textData.content;
      } else {
        Zotero.log('Full text extraction returned empty content.');
        return null;
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      Zotero.log(`Failed to extract text from PDF for item ${item.id}: ${errorMessage}`, 'error');
      return null;
    }
  }
  
  /**
   * 调用 Google Gemini API 进行问答。
   * @param apiKey 用户的 Gemini API Key。
   * @param context 从 PDF 提取的文献内容，作为回答的依据。
   * @param question 用户提出的具体问题。
   * @returns 返回一个包含 Gemini 回答的 Promise。
   */
  export async function callGeminiAPI(apiKey: string, context: string, question: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
  
    // 构建一个专业的 Prompt，指导 Gemini 的行为
    const prompt = `
  You are a professional research assistant. Your task is to answer questions based *strictly* on the provided text from a research paper. 
  Do not use any external knowledge. If the answer cannot be found in the provided text, state that clearly.
  
  Here is the text from the paper:
  ---
  ${context.substring(0, 15000)}
  ---
  
  Based on the text above, please answer the following question:
  Question: ${question}
  `;
  
    // 注意: context.substring(0, 15000) 是一个简单的安全措施，防止文本过长超出 API 的 token 限制。
    // 在生产环境中，对于非常长的 PDF，需要更复杂的文本分块（chunking）策略。
  
    const body = {
      contents: [{
        parts: [{
          text: prompt,
        }],
      }],
      // 可选：可以配置生成参数，如温度（创造性）等
      // generationConfig: {
      //   "temperature": 0.5,
      //   "topK": 1,
      //   "topP": 1,
      //   "maxOutputTokens": 2048,
      // },
    };
  
    try {
      const response = await Zotero.HTTP.request('POST', url, {
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
        },
      });
  
      const result = JSON.parse(response.text);
  
      // 健壮地解析 API 响应
      if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0]) {
        // 检查是否有 finishReason，如果是因为安全问题被 block，需要处理
        if (result.candidates[0].finishReason === 'SAFETY') {
            return 'The response was blocked due to safety concerns from the API.';
        }
        return result.candidates[0].content.parts[0].text;
      } else if (result.promptFeedback && result.promptFeedback.blockReason) {
        // 如果整个 prompt 被 block
        return `The request was blocked by the Gemini API. Reason: ${result.promptFeedback.blockReason}`;
      } else {
        // 其他未知错误
        Zotero.log(`Gemini API returned an unexpected response structure: ${JSON.stringify(result)}`, 'warn');
        return 'The Gemini API returned an empty or unexpected response. Please check the debug log.';
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Zotero.log(`Gemini API request failed: ${errorMessage}`, 'error');
      // 向用户抛出更友好的错误信息
      throw new Error('Failed to communicate with the Gemini API. Please check your network connection, API Key, and the Zotero debug output.');
    }
  }