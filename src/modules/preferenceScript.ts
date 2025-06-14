import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs"; // 导入 getPref 和 setPref

export async function registerPrefsScripts(_window: Window) {
  // This function is called when the prefs window is opened
  // See addon/content/preferences.xhtml onpaneload
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
      columns: [
        {
          dataKey: "title",
          label: getString("prefs-table-title"),
          fixedWidth: true,
          width: 100,
        },
        {
          dataKey: "detail",
          label: getString("prefs-table-detail"),
        },
      ],
      rows: [
        // { // 移除硬编码的示例数据
        //   title: "Orange",
        //   detail: "It's juicy",
        // },
        // { // 移除硬编码的示例数据
        //   title: "Banana",
        //   detail: "It's sweet",
        // },
        // { // 移除硬编码的示例数据
        //   title: "Apple",
        //   detail: "I mean the fruit APPLE",
        // },
      ],
    };
  } else {
    addon.data.prefs.window = _window;
  }
  updatePrefsUI();
  bindPrefEvents();

  // 加载并显示保存的 API Key
  const apiKeyInput = addon.data.prefs.window.document?.querySelector(
    `#zotero-prefpane-${config.addonRef}-apiKey`,
  ) as HTMLInputElement;
  if (apiKeyInput) {
    apiKeyInput.value = getPref("apiKey") || "";
  }

  // 加载并显示保存的模型选择
  const modelMenulist = addon.data.prefs.window.document?.querySelector(
    `#zotero-prefpane-${config.addonRef}-model`,
  ) as XUL.MenuList;
  if (modelMenulist) {
    modelMenulist.value = getPref("model") || "gemini-pro"; // 设置默认值
  }
}

async function updatePrefsUI() {
  // You can initialize some UI elements on prefs window
  // with addon.data.prefs.window.document
  // Or bind some events to the elements
  const renderLock = ztoolkit.getGlobal("Zotero").Promise.defer();
  if (addon.data.prefs?.window == undefined) return;
  const tableHelper = new ztoolkit.VirtualizedTable(addon.data.prefs?.window)
    .setContainerId(`${config.addonRef}-table-container`)
    .setProp({
      id: `${config.addonRef}-prefs-table`,
      // Do not use setLocale, as it modifies the Zotero.Intl.strings
      // Set locales directly to columns
      columns: addon.data.prefs?.columns,
      showHeader: true,
      multiSelect: true,
      staticColumns: true,
      disableFontSizeScaling: true,
    })
    .setProp("getRowCount", () => addon.data.prefs?.rows.length || 0)
    .setProp(
      "getRowData",
      (index) =>
        addon.data.prefs?.rows[index] || {
          title: "no data",
          detail: "no data",
        },
    )
    // Show a progress window when selection changes
    .setProp("onSelectionChange", (selection) => {
      new ztoolkit.ProgressWindow(config.addonName)
        .createLine({
          text: `Selected line: ${addon.data.prefs?.rows
            .filter((v, i) => selection.isSelected(i))
            .map((row) => row.title)
            .join(",")}`,
          progress: 100,
        })
        .show();
    })
    // When pressing delete, delete selected line and refresh table.
    // Returning false to prevent default event.
    .setProp("onKeyDown", (event: KeyboardEvent) => {
      if (event.key == "Delete" || (Zotero.isMac && event.key == "Backspace")) {
        addon.data.prefs!.rows =
          addon.data.prefs?.rows.filter(
            (v, i) => !tableHelper.treeInstance.selection.isSelected(i),
          ) || [];
        tableHelper.render();
        return false;
      }
      return true;
    })
    // For find-as-you-type
    .setProp(
      "getRowString",
      (index) => addon.data.prefs?.rows[index].title || "",
    )
    // Render the table.
    .render(-1, () => {
      renderLock.resolve();
    });
  await renderLock.promise;
  ztoolkit.log("Preference table rendered!");
}

function bindPrefEvents() {
  addon.data
    .prefs!.window.document?.querySelector(
      `#zotero-prefpane-${config.addonRef}-enable`,
    )
    ?.addEventListener("command", (e: Event) => {
      ztoolkit.log(e);
      addon.data.prefs!.window.alert(
        `Successfully changed to ${(e.target as XUL.Checkbox).checked}!`, 
      );
    });

  addon.data
    .prefs!.window.document?.querySelector(
      `#zotero-prefpane-${config.addonRef}-input`,
    )
    ?.addEventListener("change", (e: Event) => {
      ztoolkit.log(e);
      addon.data.prefs!.window.alert(
        `Successfully changed to ${(e.target as HTMLInputElement).value}!`, 
      );
    });

  // 为 API Key 输入框添加 change 事件监听器，保存 API Key
  addon.data
    .prefs!.window.document?.querySelector(
      `#zotero-prefpane-${config.addonRef}-apiKey`,
    )
    ?.addEventListener("change", (e: Event) => {
      const newApiKey = (e.target as HTMLInputElement).value;
      setPref("apiKey", newApiKey);
      ztoolkit.log(`Gemini API Key saved: ${newApiKey}`);
    });

  // 为模型选择下拉菜单添加 command 事件监听器，保存模型
  addon.data
    .prefs!.window.document?.querySelector(
      `#zotero-prefpane-${config.addonRef}-model`,
    )
    ?.addEventListener("command", (e: Event) => {
      const newModel = (e.target as XUL.MenuList).value;
      setPref("model", newModel);
      ztoolkit.log(`Gemini Model saved: ${newModel}`);
    });
}
