import type { Locale } from "./types";
import type { EditorCommandMessage } from "../commands/editorCommands";

export type EditorCopy = {
  assets: {
    allAssets: string;
    assetFilter: string;
    assetsTab: string;
    bindButton: string;
    bindHint: string;
    bindImage: (name: string) => string;
    bindSelectedImage: string;
    clearSearch: string;
    columns: {
      name: string;
      size: string;
      type: string;
      use: string;
    };
    deleteAsset: (name: string) => string;
    emptyAssets: string;
    emptyResources: string;
    filterResources: string;
    filterPlaceholder: string;
    fonts: string;
    fontsTab: string;
    gridActive: string;
    gridView: string;
    images: string;
    importAsset: string;
    importReference: (name: string) => string;
    importReferenceButton: string;
    importToBind: string;
    listActive: string;
    listView: string;
    reference: string;
    referenceResource: string;
    resourceCount: (count: number) => string;
    resourceCategories: string;
    sampleMeta: (type: string, detail: string) => string;
    selectReference: (name: string, type: string, meta: string) => string;
    selectResource: (name: string, type: string, summary: string, usage: string) => string;
    selectedResource: string;
    showAssets: string;
    showFonts: string;
    title: string;
    typeFont: string;
    typeImage: string;
    unused: string;
    used: (count: number) => string;
  };
  bottomDock: {
    build: string;
    buildLabel: string;
    buildStatusLabels: Record<"failed" | "idle" | "queued" | "running" | "saving" | "succeeded", string>;
    buildStatus: string;
    collapse: string;
    commandLabel: (label: string) => string;
    commandMessageLabel: (message: EditorCommandMessage) => string;
    console: string;
    downloadExport: (projectName: string) => string;
    emptyConsole: string;
    emptyTimeline: string;
    expand: string;
    heightValue: (height: number) => string;
    projectActivity: string;
    resize: string;
    resources: string;
    sections: string;
    timeline: string;
    timelineColumns: {
      item: string;
      kind: string;
      status: string;
    };
    timelineKinds: Record<"Command" | "Event" | "Screen", string>;
    timelineStatuses: Record<"active" | "available" | "bound" | "done" | "selected" | "undone", string>;
    logColumns: {
      message: string;
      time: string;
    };
  };
  dialogs: {
    assetDeleteCancel: (name?: string) => string;
    assetDeleteConfirm: (name?: string) => string;
    assetDeleteDescription: (name: string, usageCount: number) => string;
    assetDeleteTitle: string;
    cancel: string;
    cancelNewProject: string;
    createProject: string;
    createProjectNamed: (name: string) => string;
    newProjectDescription: string;
    newProjectName: string;
    newProjectNameA11y: string;
    newProjectTitle: string;
  };
  canvas: {
    addReusableStyle: string;
    addScreen: string;
    apply: string;
    applyReusableStyle: (styleName: string, widgetName?: string) => string;
    backToCanvas: (screenName: string) => string;
    backToCanvasButton: string;
    background: string;
    canvas: string;
    canvasZoom: string;
    code: string;
    colorDepth: string;
    colorDepthOption: (depth: number) => string;
    copyCode: (fileName: string) => string;
    currentScreen: string;
    dark: string;
    deleteReusableStyle: (styleName: string) => string;
    device: string;
    fitView: (screenName: string) => string;
    fullscreen: (screenName: string) => string;
    generatedSource: string;
    height: string;
    lineCount: (count: number) => string;
    light: string;
    lvglVersion: string;
    dpi: string;
    openTargetSettings: (width: number, height: number) => string;
    projectName: string;
    projectNameA11y: string;
    projectSettings: string;
    radius: string;
    reusableStyleName: string;
    reusableStyles: string;
    noReusableStyles: string;
    opacity: string;
    save: string;
    screenFallback: string;
    settings: string;
    styleName: string;
    target: string;
    targetSummary: (target: { colorDepth: number; deviceName: string; dpi: number; height: number; lvglVersion: string; width: number }) => string;
    textColor: string;
    theme: string;
    width: string;
  };
  previewRuntime: {
    capturePreviewScreenshot: (screenName: string) => string;
    captureSimulatorScreenshot: (screenName: string) => string;
    closePreview: (screenName: string) => string;
    currentScreen: string;
    devicePreview: string;
    downloadPreviewScreenshot: (screenName: string) => string;
    downloadSimulatorScreenshot: (screenName: string) => string;
    dropdownDefaultOptions: string;
    dropdownFallback: string;
    fullscreenSimulator: (screenName: string) => string;
    imageMissing: string;
    openSimulatorFullscreen: (screenName: string) => string;
    preview: string;
    previewDevice: (screenName: string, targetLabel: string) => string;
    refreshPreview: (screenName: string) => string;
    refreshSimulator: (screenName: string) => string;
    resizeWidget: (name: string) => string;
    runtimeKinds: Record<"canvas" | "unknown" | "wasm", string>;
    runtimeMode: (kind: string) => string;
    selectAsset: string;
    selectWidget: (name: string, type: string) => string;
    simulator: string;
    simulatorStatus: (status: string) => string;
    switchSimulatorDark: string;
    switchSimulatorLight: string;
  };
  status: {
    autosave: string;
    cloudProjectNotCreated: string;
    cloudSaveUnavailable: string;
    editorReady: string;
    localProject: string;
    projectSavedToCloud: string;
    saveFailed: string;
    saving: string;
    coordinates: (x: number, y: number) => string;
    dpi: (dpi: number) => string;
    lvglVersion: (version: string) => string;
    saveStatus: (state: string) => string;
    signedOutLocalEditing: string;
    unsavedChanges: string;
    allChangesSaved: string;
  };
  runtime: {
    assetBoundFromPanel: string;
    assetDeleted: (name: string) => string;
    assetUploadSaveFailed: string;
    assetImportedLocally: (name: string) => string;
    assetUploaded: (name: string) => string;
    buildDirtyAfterSave: string;
    buildFailed: string;
    buildSaveFailed: string;
    buildSignInRequired: string;
    canvasFullscreenFailed: string;
    canvasFullscreenFailedWithMessage: (message: string) => string;
    canvasFullscreenOpened: string;
    canvasFullscreenUnavailable: string;
    codeCopied: string;
    codeCopyFailed: string;
    codeCopyFailedWithMessage: (message: string) => string;
    clipboardApiUnavailable: string;
    clipboardWriteTimedOut: string;
    copyingCode: string;
    downloadUnavailable: string;
    exportDownloadFailed: string;
    exportZipDownloaded: string;
    generatedCodeCopied: string;
    imageAssetSelectRequired: string;
    jobLogMessage: (message: string) => string;
    jobStatus: (status: string) => string;
    jobTimedOut: (pollLimit: number) => string;
    loadingRuntime: string;
    loggedInAs: (name: string) => string;
    loginFailed: (message: string) => string;
    noCodeToCopy: string;
    codegenBlockedInvalidAssetKind: (assetId: string) => string;
    codegenBlockedInvalidFontAssetKind: (assetId: string) => string;
    codegenBlockedMissingAsset: (assetId: string) => string;
    codegenBlockedMissingFontAsset: (assetId: string) => string;
    previewFailed: string;
    previewEventTriggered: (eventName: string, handlerName: string) => string;
    previewInteractionTemporary: string;
    previewLiveReady: string;
    previewRefreshed: string;
    previewScreenshotLogReady: string;
    previewScreenshotReady: string;
    previewScreenshotUnavailable: string;
    previewUpdated: string;
    projectCreateFailed: string;
    projectCreated: string;
    projectListFailed: string;
    projectListLoaded: string;
    projectNameRequired: string;
    projectOpened: string;
    projectOpenFailed: string;
    projectSaved: string;
    projectSaveFailed: (message: string) => string;
    renderScreen: (screenName: string) => string;
    readyToCopy: string;
    runtimeLoadFailed: string;
    selectImageWidgetBeforeBinding: string;
    signInBeforeAssets: string;
    signInBeforeAssetsError: string;
    signInBeforeCloudProjects: string;
    signInBeforeLoadingProjects: string;
    simulatorBackground: (background: string) => string;
    simulatorFullscreenFailed: string;
    simulatorFullscreenFailedWithMessage: (message: string) => string;
    simulatorFullscreenOpened: string;
    simulatorFullscreenUnavailable: string;
    simulatorHidden: string;
    simulatorLoaded: string;
    simulatorRefreshed: string;
    simulatorScreenshotReady: string;
    simulatorScreenshotUnavailable: string;
    unknownError: string;
    untitledProjectName: string;
  };
  inspector: {
    addEvent: string;
    addEventToTarget: (eventName: string, targetName: string) => string;
    a11y: {
      eventHandler: string;
      eventTarget: string;
      eventType: string;
      backgroundColor: string;
      blendMode: string;
      borderColor: string;
      chartPointCount: string;
      chartValues: string;
      dropdownOptions: string;
      flexDirection: string;
      flexGap: string;
      flexWrap: string;
      imageAsset: string;
      layoutHeight: string;
      layoutX: string;
      layoutY: string;
      layoutWidth: string;
      maximumValue: string;
      minimumValue: string;
      selectedWidgetText: string;
      checkboxText: string;
      layoutAlignment: string;
      arcLength: string;
      letterSpacing: string;
      lineSpacing: string;
      paddingBottom: string;
      paddingLeft: string;
      paddingRight: string;
      paddingTop: string;
      selectedOptionIndex: string;
      spinTime: string;
      targetColorDepth: string;
      targetDeviceName: string;
      targetDpi: string;
      targetHeight: string;
      targetLvglVersion: string;
      targetWidth: string;
      textAlignment: string;
      textColor: string;
      textFont: string;
      value: string;
    };
    asset: string;
    boundToAsset: (name: string) => string;
    colorPreview: (label: string, value: string) => string;
    columns: {
      action: string;
      event: string;
      handler: string;
      target: string;
    };
    emptyBody: string;
    emptyTitle: string;
    enterHandler: (eventName: string, targetName: string) => string;
    eventEmpty: string;
    fontAssetWarning: (font: string) => string;
    fontAssetExportNote: string;
    imageAssetMissing: string;
    imageAssetNone: string;
    imageAssetNotImported: string;
    removeEvent: (eventName: string, targetName: string, handlerName: string) => string;
    sections: {
      appearance: string;
      events: string;
      image: string;
      layout: string;
      props: string;
      selector: string;
      target: string;
      text: string;
    };
    selectedWidget: string;
    selectedWidgetName: string;
    tabs: {
      events: string;
      inspector: string;
      layout: string;
    };
    tabSections: string;
    unlockToAddEvents: (targetName: string) => string;
    errors: {
      chartValuesInvalid: string;
      chartValuesRequired: string;
      deviceNameRequired: string;
      greaterThanZero: (field: string) => string;
      greaterThan: (field: string, comparison: string) => string;
      hexColor: (field: string) => string;
      integer: (field: string) => string;
      nonNegative: (field: string) => string;
      number: (field: string) => string;
      range: (field: string, min: number, max: number) => string;
    };
    fields: {
      align: string;
      arcLength: string;
      background: string;
      blendMode: string;
      border: string;
      checked: string;
      colorDepth: string;
      default: string;
      device: string;
      event: string;
      flexDirection: string;
      font: string;
      gap: string;
      handler: string;
      height: string;
      imageNone: string;
      letterSpace: string;
      lineSpace: string;
      max: string;
      min: string;
      opacity: string;
      options: string;
      paddingBottom: string;
      paddingLeft: string;
      paddingRight: string;
      paddingTop: string;
      pointCount: string;
      radius: string;
      selected: string;
      spinTime: string;
      target: string;
      text: string;
      textColor: string;
      value: string;
      values: string;
      width: string;
      wrap: string;
    };
    options: {
      blendMode: Record<"additive" | "multiply" | "normal" | "replace" | "subtractive", string>;
      flexDirection: Record<"column" | "row", string>;
      layoutAlign: Record<"bottom-left" | "bottom-right" | "center" | "top-left" | "top-right", string>;
      textAlign: Record<"center" | "left" | "right", string>;
    };
  };
  navigation: {
    code: string;
    editorSections: string;
    inspector: string;
    layers: string;
    resources: string;
    screens: string;
    selectedSection: (label: string) => string;
    settings: string;
    widgets: string;
    openSection: (label: string) => string;
  };
  widgets: {
    addWidget: (label: string) => string;
    clearSearch: string;
    emptySearch: (query: string) => string;
    resultCount: (count: number) => string;
    search: string;
    searchPlaceholder: string;
    title: string;
    categories: Record<"Advanced" | "Basic" | "Charts" | "Containers" | "Indicators" | "Inputs", string>;
    names: Record<string, string>;
  };
  layers: {
    clearSearch: string;
    columnObject: string;
    columnState: string;
    columnTools: string;
    deleteLayer: (name: string) => string;
    empty: string;
    hidden: string;
    hideLayer: (name: string) => string;
    layerCount: (count: number) => string;
    layerHidden: string;
    layerVisible: string;
    locked: string;
    lockLayer: (name: string) => string;
    moveLayer: (name: string, direction: "up" | "down") => string;
    noSearchResults: string;
    renameLayer: (name: string) => string;
    screenFallback: string;
    screenType: string;
    search: string;
    searchPlaceholder: string;
    selectLayer: (name: string, type: string) => string;
    selectScreenRoot: (name: string) => string;
    showLayer: (name: string) => string;
    title: string;
    unlockLayer: (name: string) => string;
  };
  screens: {
    active: string;
    add: string;
    columnScreen: string;
    columnState: string;
    columnWidgets: string;
    createScreen: (name: string, state: string, meta: string) => string;
    delete: string;
    deleteScreen: (name: string) => string;
    draft: string;
    duplicate: string;
    duplicateScreen: (name: string) => string;
    openScreen: (name: string, state: string, meta: string) => string;
    ready: string;
    renameActiveScreen: string;
    renameScreen: (name: string) => string;
    screenCount: (count: number) => string;
    screenNamePlaceholder: string;
    title: string;
    uniqueNames: string;
    widgetCount: (count: number) => string;
  };
  toolbar: {
    applicationMenus: string;
    build: string;
    buildCExport: string;
    buildCExportSignedOut: string;
    building: string;
    cloudProjectCount: (count: number) => string;
    copySelectedWidget: string;
    copyWidget: (name: string) => string;
    copy: string;
    createCloudProject: string;
    currentProject: (name: string) => string;
    delete: string;
    deleteSelectedWidget: string;
    deleteWidget: (name: string) => string;
    demo: string;
    demoAccountConnected: string;
    demoLogin: string;
    edit: string;
    editorLanguage: string;
    email: string;
    emailForCloudLogin: string;
    export: string;
    file: string;
    gridDisabled: string;
    gridEnabled: string;
    gridHide: string;
    gridShow: string;
    help: string;
    hideSimulator: string;
    language: string;
    light: string;
    dark: string;
    login: string;
    loginFromProjectMenu: string;
    loginToBuild: string;
    loginWithDemoAccount: string;
    logout: string;
    menuOpen: (label: string) => string;
    newProjectA11y: string;
    newProject: string;
    noCloudProjects: string;
    open: string;
    openCloudProject: string;
    openCloudProjectFromMenu: string;
    openMenu: (label: string) => string;
    openProjectMenu: string;
    openTargetSettingsFor: (targetLabel: string) => string;
    productName: string;
    localeNames: Record<Locale, string>;
    password: string;
    passwordForCloudLogin: string;
    paste: string;
    pasteCopiedWidget: string;
    pasteWidget: (name: string) => string;
    preview: string;
    previewBeforeExport: string;
    previewCurrentScreen: string;
    project: string;
    projectMenuOpen: string;
    projectName: string;
    projectTheme: string;
    refreshCloudProjects: string;
    redo: string;
    saveProject: (name: string) => string;
    saveProjectMenu: string;
    save: string;
    signInToBuild: string;
    showSimulator: string;
    simulator: string;
    simulatorShow: string;
    snapDisable: string;
    snapDisabled: string;
    snapEnabled: string;
    snapEnable: string;
    target: string;
    targetSettings: string;
    theme: string;
    tools: string;
    undo: string;
    view: string;
  };
};

export const editorCopy: Record<Locale, EditorCopy> = {
  "en-US": {
    assets: {
      allAssets: "All Assets",
      assetFilter: "Asset filter",
      assetsTab: "Assets",
      bindButton: "Bind to Image",
      bindHint: "Select an unlocked image widget to bind this resource.",
      bindImage: (name) => `Bind ${name} to selected image widget`,
      bindSelectedImage: "Bind selected resource to selected image widget",
      clearSearch: "Clear asset search",
      columns: {
        name: "Name",
        size: "Size",
        type: "Type",
        use: "Use"
      },
      deleteAsset: (name) => `Delete ${name} resource`,
      emptyAssets: "No matching assets",
      emptyResources: "No matching resources",
      filterResources: "Filter resources",
      filterPlaceholder: "Filter assets...",
      fonts: "Fonts",
      fontsTab: "Fonts",
      gridActive: "Resources are shown as a grid",
      gridView: "Show resources as a grid",
      images: "Images",
      importAsset: "Import asset",
      importReference: (name) => `Import ${name} reference resource`,
      importReferenceButton: "Import Reference",
      importToBind: "Import to bind",
      listActive: "Resources are shown as a list",
      listView: "Show resources as a list",
      reference: "Reference",
      referenceResource: "Reference Resource",
      resourceCount: (count) => `${count} ${count === 1 ? "resource" : "resources"}`,
      resourceCategories: "Resource categories",
      sampleMeta: (type, detail) => `${type.toLowerCase()} ${detail}`,
      selectReference: (name, type, meta) => `Select reference resource ${name}, ${type}, ${meta}`,
      selectResource: (name, type, summary, usage) => `Select resource ${name}, ${type}, ${summary}, ${usage}`,
      selectedResource: "Selected Resource",
      showAssets: "Show asset resources",
      showFonts: "Show font resources",
      title: "Resources",
      typeFont: "Font",
      typeImage: "Image",
      unused: "Unused",
      used: (count) => `Used ${count}`
    },
    bottomDock: {
      build: "Build",
      buildLabel: "Build:",
      buildStatusLabels: {
        failed: "failed",
        idle: "idle",
        queued: "queued",
        running: "running",
        saving: "saving",
        succeeded: "succeeded"
      },
      buildStatus: "Build Status",
      collapse: "Collapse console simulator and build dock",
      commandLabel: (label) => timelineCommandLabel(label, "en-US"),
      commandMessageLabel: (message) => timelineCommandMessageLabel(message, "en-US"),
      console: "Console",
      downloadExport: (projectName) => `Download ${projectName} LVGL C zip`,
      emptyConsole: "No console messages yet.",
      emptyTimeline: "No project activity yet.",
      expand: "Expand console simulator and build dock",
      heightValue: (height) => `Bottom dock height ${height} pixels`,
      projectActivity: "Project Activity",
      resize: "Resize bottom dock",
      resources: "Resources",
      sections: "Bottom dock sections",
      timeline: "Timeline",
      timelineColumns: {
        item: "Item",
        kind: "Kind",
        status: "Status"
      },
      timelineKinds: {
        Command: "Command",
        Event: "Event",
        Screen: "Screen"
      },
      timelineStatuses: {
        active: "active",
        available: "available",
        bound: "bound",
        done: "done",
        selected: "selected",
        undone: "undone"
      },
      logColumns: {
        message: "Message",
        time: "Time"
      }
    },
    dialogs: {
      assetDeleteCancel: (name) => name ? `Cancel deleting ${name} asset` : "Cancel deleting asset",
      assetDeleteConfirm: (name) => name ? `Delete ${name} asset` : "Delete asset",
      assetDeleteDescription: (name, usageCount) => `${name} is used by ${usageCount} resource reference${usageCount === 1 ? "" : "s"}. Deleting it will clear those resource references.`,
      assetDeleteTitle: "Delete referenced asset?",
      cancel: "Cancel",
      cancelNewProject: "Cancel creating cloud project",
      createProject: "Create project",
      createProjectNamed: (name) => name ? `Create ${name} cloud project` : "Create cloud project",
      newProjectDescription: "Name the LVGL project before creating it in cloud storage.",
      newProjectName: "Project Name",
      newProjectNameA11y: "Cloud project name",
      newProjectTitle: "Create cloud project"
    },
    canvas: {
      addReusableStyle: "Add reusable style",
      addScreen: "Add screen from canvas toolbar",
      apply: "Apply",
      applyReusableStyle: (styleName, widgetName) => widgetName ? `Apply ${styleName} to ${widgetName}` : `Select a widget to apply ${styleName}`,
      backToCanvas: (screenName) => `Back to ${screenName} canvas`,
      backToCanvasButton: "Back to Canvas",
      background: "Background",
      canvas: "Canvas",
      canvasZoom: "Canvas zoom",
      code: "Code",
      colorDepth: "Color Depth",
      colorDepthOption: (depth) => `${depth} bit`,
      copyCode: (fileName) => `Copy generated code for ${fileName}`,
      currentScreen: "current screen",
      dark: "Dark",
      deleteReusableStyle: (styleName) => `Delete ${styleName} reusable style`,
      device: "Device",
      fitView: (screenName) => `Fit ${screenName} canvas view`,
      fullscreen: (screenName) => `Open ${screenName} canvas fullscreen`,
      generatedSource: "Generated Source",
      height: "Height",
      lineCount: (count) => `${count} ${count === 1 ? "line" : "lines"}`,
      light: "Light",
      lvglVersion: "LVGL Version",
      dpi: "DPI",
      openTargetSettings: (width, height) => `Open target settings for ${width} x ${height}`,
      projectName: "Project Name",
      projectNameA11y: "Project name",
      projectSettings: "Project Settings",
      radius: "Radius",
      reusableStyleName: "Reusable style name",
      reusableStyles: "Reusable Styles",
      noReusableStyles: "No reusable styles yet.",
      opacity: "Opacity",
      save: "Save",
      screenFallback: "Screen",
      settings: "Settings",
      styleName: "Style Name",
      target: "Target",
      targetSummary: (target) => `${target.deviceName} / ${target.width} x ${target.height} · ${target.dpi} DPI · ${target.colorDepth}-bit · LVGL ${target.lvglVersion}`,
      textColor: "Text Color",
      theme: "Theme",
      width: "Width"
    },
    previewRuntime: {
      capturePreviewScreenshot: (screenName) => `Capture ${screenName} preview screenshot`,
      captureSimulatorScreenshot: (screenName) => `Capture ${screenName} simulator screenshot`,
      closePreview: (screenName) => `Close ${screenName} preview`,
      currentScreen: "current screen",
      devicePreview: "Device preview",
      downloadPreviewScreenshot: (screenName) => `Download ${screenName} preview screenshot`,
      downloadSimulatorScreenshot: (screenName) => `Download ${screenName} simulator screenshot`,
      dropdownDefaultOptions: "Option 1\nOption 2",
      dropdownFallback: "Dropdown",
      fullscreenSimulator: (screenName) => `Open ${screenName} simulator fullscreen`,
      imageMissing: "Missing preview",
      openSimulatorFullscreen: (screenName) => `Open ${screenName} simulator fullscreen`,
      preview: "Preview",
      previewDevice: (screenName, targetLabel) => `${screenName} preview on ${targetLabel}`,
      refreshPreview: (screenName) => `Refresh ${screenName} preview`,
      refreshSimulator: (screenName) => `Refresh ${screenName} simulator`,
      resizeWidget: (name) => `Resize ${name} widget`,
      runtimeKinds: {
        canvas: "Canvas fallback",
        unknown: "Runtime pending",
        wasm: "LVGL WASM"
      },
      runtimeMode: (kind) => `Simulator runtime: ${kind}`,
      selectAsset: "Select an asset",
      selectWidget: (name, type) => `Select and drag ${name} ${type} widget`,
      simulator: "Simulator",
      simulatorStatus: (status) => `Simulator status: ${status}`,
      switchSimulatorDark: "Switch simulator to dark background",
      switchSimulatorLight: "Switch simulator to light background"
    },
    status: {
      autosave: "Autosave",
      cloudProjectNotCreated: "Cloud project not created",
      cloudSaveUnavailable: "Cloud save unavailable",
      editorReady: "Editor ready",
      localProject: "Local project",
      projectSavedToCloud: "Project saved to cloud",
      saveFailed: "Save failed",
      saving: "Saving...",
      coordinates: (x, y) => `X: ${x} Y: ${y}`,
      dpi: (dpi) => `DPI: ${dpi}`,
      lvglVersion: (version) => `LVGL v${version}`,
      saveStatus: (state) => `Save status: ${state}`,
      signedOutLocalEditing: "Signed out; local editing remains",
      unsavedChanges: "Unsaved changes",
      allChangesSaved: "All changes saved"
    },
    runtime: {
      assetBoundFromPanel: "Image asset bound from Assets panel",
      assetDeleted: (name) => `Asset deleted: ${name}`,
      assetUploadSaveFailed: "Asset upload stopped because project save failed",
      assetImportedLocally: (name) => `Asset imported locally: ${name}`,
      assetUploaded: (name) => `Asset uploaded: ${name}`,
      buildDirtyAfterSave: "Build stopped because there are new unsaved changes",
      buildFailed: "Build failed",
      buildSaveFailed: "Build stopped because project save failed",
      buildSignInRequired: "Sign in before Build to create a cloud project and export C code",
      canvasFullscreenFailed: "Canvas fullscreen failed",
      canvasFullscreenFailedWithMessage: (message) => `Canvas fullscreen failed: ${message}`,
      canvasFullscreenOpened: "Canvas fullscreen opened",
      canvasFullscreenUnavailable: "Canvas fullscreen unavailable",
      codeCopied: "Code copied",
      codeCopyFailed: "Copy failed",
      codeCopyFailedWithMessage: (message) => `Copy code failed: ${message}`,
      clipboardApiUnavailable: "Clipboard API unavailable",
      clipboardWriteTimedOut: "Clipboard write timed out",
      copyingCode: "Copying...",
      downloadUnavailable: "Download is not available in this browser",
      exportDownloadFailed: "Export download failed",
      exportZipDownloaded: "Export zip downloaded",
      generatedCodeCopied: "Generated code copied to clipboard",
      imageAssetSelectRequired: "Select an unlocked image widget before binding an asset",
      jobLogMessage: (message) => jobLogMessage(message, "en-US"),
      jobStatus: (status) => `Job status: ${jobStatusLabel(status, "en-US")}`,
      jobTimedOut: (pollLimit) => `Export job timed out after ${pollLimit} polls`,
      loadingRuntime: "Loading runtime",
      loggedInAs: (name) => `Logged in as ${name}`,
      loginFailed: (message) => `Login failed: ${message}`,
      noCodeToCopy: "No code to copy",
      codegenBlockedInvalidAssetKind: (assetId) => `Code generation blocked: image widget must reference an image asset ${assetId}`,
      codegenBlockedInvalidFontAssetKind: (assetId) => `Code generation blocked: font style must reference a font asset ${assetId}`,
      codegenBlockedMissingAsset: (assetId) => `Code generation blocked: missing image asset ${assetId}`,
      codegenBlockedMissingFontAsset: (assetId) => `Code generation blocked: missing font asset ${assetId}`,
      previewFailed: "Preview failed",
      previewEventTriggered: (eventName, handlerName) => `Preview event ${eventName} -> ${handlerName}`,
      previewInteractionTemporary: "Preview interaction is temporary. Refresh preview before capturing a screenshot.",
      previewLiveReady: "Live preview ready",
      previewRefreshed: "Preview refreshed",
      previewScreenshotLogReady: "Preview screenshot ready",
      previewScreenshotReady: "Screenshot ready",
      previewScreenshotUnavailable: "Screenshot unavailable",
      previewUpdated: "Preview updated",
      projectCreateFailed: "Project create failed",
      projectCreated: "Project created",
      projectListFailed: "Project list failed",
      projectListLoaded: "Project list loaded",
      projectNameRequired: "Project name is required",
      projectOpened: "Project opened",
      projectOpenFailed: "Project open failed",
      projectSaved: "Project saved",
      projectSaveFailed: (message) => `Project save failed: ${message}`,
      renderScreen: (screenName) => `Rendering ${screenName}`,
      readyToCopy: "Ready to copy",
      runtimeLoadFailed: "Runtime load failed",
      selectImageWidgetBeforeBinding: "Select an unlocked image widget before binding an asset",
      signInBeforeAssets: "Sign in before uploading assets",
      signInBeforeAssetsError: "Sign in before uploading assets",
      signInBeforeCloudProjects: "Sign in before creating cloud projects",
      signInBeforeLoadingProjects: "Sign in before loading cloud projects",
      simulatorBackground: (background) => `Simulator background ${background}`,
      simulatorFullscreenFailed: "Simulator fullscreen failed",
      simulatorFullscreenFailedWithMessage: (message) => `Simulator fullscreen failed: ${message}`,
      simulatorFullscreenOpened: "Simulator fullscreen opened",
      simulatorFullscreenUnavailable: "Simulator fullscreen unavailable",
      simulatorHidden: "Simulator hidden",
      simulatorLoaded: "Simulator loaded",
      simulatorRefreshed: "Simulator refreshed",
      simulatorScreenshotReady: "Simulator screenshot ready",
      simulatorScreenshotUnavailable: "Simulator screenshot unavailable",
      unknownError: "Unknown error",
      untitledProjectName: "Untitled LVGL UI"
    },
    inspector: {
      addEvent: "Add Event",
      addEventToTarget: (eventName, targetName) => `Add ${eventName} event to ${targetName}`,
      a11y: {
        eventHandler: "Event handler",
        eventTarget: "Event target",
        eventType: "Event type",
        backgroundColor: "Background color",
        blendMode: "Blend mode",
        borderColor: "Border color",
        chartPointCount: "Chart point count",
        chartValues: "Chart values",
        dropdownOptions: "Dropdown options",
        flexDirection: "Flex direction",
        flexGap: "Flex gap",
        flexWrap: "Flex wrap",
        imageAsset: "Image asset",
        layoutHeight: "Layout height",
        layoutX: "Layout X",
        layoutY: "Layout Y",
        layoutWidth: "Layout width",
        maximumValue: "Maximum value",
        minimumValue: "Minimum value",
        selectedWidgetText: "Selected widget text",
        checkboxText: "Checkbox text",
        layoutAlignment: "Layout alignment",
        arcLength: "Arc length",
        letterSpacing: "Letter spacing",
        lineSpacing: "Line spacing",
        paddingBottom: "Padding bottom",
        paddingLeft: "Padding left",
        paddingRight: "Padding right",
        paddingTop: "Padding top",
        selectedOptionIndex: "Selected option index",
        spinTime: "Spin time",
        targetColorDepth: "Target color depth",
        targetDeviceName: "Target device name",
        targetDpi: "Target DPI",
        targetHeight: "Target height",
        targetLvglVersion: "Target LVGL version",
        targetWidth: "Target width",
        textAlignment: "Text alignment",
        textColor: "Text color",
        textFont: "Text font",
        value: "Current value"
      },
      asset: "Asset",
      boundToAsset: (name) => `Bound to ${name}`,
      colorPreview: (label, value) => `${label} preview ${value}`,
      columns: {
        action: "Action",
        event: "Event",
        handler: "Handler",
        target: "Target"
      },
      emptyBody: "Select a widget from Canvas or Layers to edit Inspector, Events and Layout.",
      emptyTitle: "No widget selected",
      enterHandler: (eventName, targetName) => `Enter handler to add ${eventName} event to ${targetName}`,
      eventEmpty: "No events bound to this selection.",
      fontAssetWarning: (font) => `Unknown font asset or unsupported LVGL font symbol: ${font}`,
      fontAssetExportNote: "Uploaded font files are stored as metadata only in V1. Use a built-in lv_font_* symbol or convert the font before exporting C code.",
      imageAssetMissing: "Selected image asset is missing from this project.",
      imageAssetNone: "No image asset selected.",
      imageAssetNotImported: "No image assets imported. Use the Assets panel + button to import one.",
      removeEvent: (eventName, targetName, handlerName) => `Remove ${eventName} event from ${targetName} handled by ${handlerName}`,
      sections: {
        appearance: "Appearance",
        events: "Events",
        image: "Image",
        layout: "Layout",
        props: "Props",
        selector: "Selector",
        target: "Target",
        text: "Text"
      },
      selectedWidget: "selected widget",
      selectedWidgetName: "Selected widget name",
      tabs: {
        events: "Events",
        inspector: "Inspector",
        layout: "Layout"
      },
      tabSections: "Inspector sections",
      unlockToAddEvents: (targetName) => `Unlock ${targetName} to add events`,
      errors: {
        chartValuesInvalid: "Values must be comma, space or newline separated numbers",
        chartValuesRequired: "Values must contain at least one number",
        deviceNameRequired: "Device name is required",
        greaterThanZero: (field) => `${field} must be greater than 0`,
        greaterThan: (field, comparison) => `${field} must be greater than ${comparison}`,
        hexColor: (field) => `${field} must be a 3 or 6 digit hex color`,
        integer: (field) => `${field} must be an integer`,
        nonNegative: (field) => `${field} must be non-negative`,
        number: (field) => `${field} must be a number`,
        range: (field, min, max) => `${field} must be between ${min} and ${max}`
      },
      fields: {
        align: "Align",
        arcLength: "Arc Length",
        background: "Background",
        blendMode: "Blend Mode",
        border: "Border",
        checked: "Checked",
        colorDepth: "Color Depth",
        default: "Default",
        device: "Device",
        event: "Event",
        flexDirection: "Flex Direction",
        font: "Font",
        gap: "Gap",
        handler: "Handler",
        height: "Height",
        imageNone: "None",
        letterSpace: "Letter Space",
        lineSpace: "Line Space",
        max: "Max",
        min: "Min",
        opacity: "Opacity",
        options: "Options",
        paddingBottom: "Padding Bottom",
        paddingLeft: "Padding Left",
        paddingRight: "Padding Right",
        paddingTop: "Padding Top",
        pointCount: "Point Count",
        radius: "Radius",
        selected: "Selected",
        spinTime: "Spin Time",
        target: "Target",
        text: "Text",
        textColor: "Text Color",
        value: "Value",
        values: "Values",
        width: "Width",
        wrap: "Wrap"
      },
      options: {
        blendMode: {
          additive: "Additive",
          multiply: "Multiply",
          normal: "Normal",
          replace: "Replace",
          subtractive: "Subtractive"
        },
        flexDirection: {
          column: "Column",
          row: "Row"
        },
        layoutAlign: {
          "bottom-left": "Bottom left",
          "bottom-right": "Bottom right",
          center: "Center",
          "top-left": "Top left",
          "top-right": "Top right"
        },
        textAlign: {
          center: "Center",
          left: "Left",
          right: "Right"
        }
      }
    },
    navigation: {
      code: "Code",
      editorSections: "Editor sections",
      inspector: "Inspector",
      layers: "Layers",
      resources: "Resources",
      screens: "Screens",
      selectedSection: (label) => `${label} section selected`,
      settings: "Settings",
      widgets: "Widgets",
      openSection: (label) => `Open ${label} section`
    },
    widgets: {
      addWidget: (label) => `Add ${label} widget`,
      clearSearch: "Clear widget search",
      emptySearch: (query) => `No widgets match "${query}".`,
      resultCount: (count) => `${count} ${count === 1 ? "widget" : "widgets"}`,
      search: "Search widgets",
      searchPlaceholder: "Search widgets...",
      title: "Widgets",
      categories: {
        Advanced: "Advanced",
        Basic: "Basic",
        Charts: "Charts",
        Containers: "Containers",
        Indicators: "Indicators",
        Inputs: "Inputs"
      },
      names: {
        arc: "Arc",
        bar: "Bar",
        button: "Button",
        chart: "Chart",
        checkbox: "Checkbox",
        container: "Container",
        dropdown: "Dropdown",
        image: "Image",
        label: "Label",
        line: "Line",
        slider: "Slider",
        spinner: "Spinner",
        switch: "Switch"
      }
    },
    layers: {
      clearSearch: "Clear layer search",
      columnObject: "Object",
      columnState: "State",
      columnTools: "Tools",
      deleteLayer: (name) => `Delete ${name} layer`,
      empty: "No widgets on this screen. Add one from Widgets or drop it on the canvas.",
      hidden: "Hidden",
      hideLayer: (name) => `Hide ${name} layer`,
      layerCount: (count) => `${count} ${count === 1 ? "layer" : "layers"}`,
      layerHidden: "Layer hidden",
      layerVisible: "Layer visible",
      locked: "Locked",
      lockLayer: (name) => `Lock ${name} layer`,
      moveLayer: (name, direction) => `Move ${name} layer ${direction}`,
      noSearchResults: "No layers match this search.",
      renameLayer: (name) => `Rename ${name} layer`,
      screenFallback: "Screen",
      screenType: "screen",
      search: "Search layers",
      searchPlaceholder: "Search layers...",
      selectLayer: (name, type) => `Select ${name} ${type} layer`,
      selectScreenRoot: (name) => `Select screen root ${name}`,
      showLayer: (name) => `Show ${name} layer`,
      title: "Layers",
      unlockLayer: (name) => `Unlock ${name} layer`
    },
    screens: {
      active: "Active",
      add: "Add screen",
      columnScreen: "Screen",
      columnState: "State",
      columnWidgets: "Widgets",
      createScreen: (name, state, meta) => `Create ${name} screen, ${state}, ${meta}`,
      delete: "Delete screen",
      deleteScreen: (name) => `Delete ${name} screen`,
      draft: "Draft",
      duplicate: "Duplicate screen",
      duplicateScreen: (name) => `Duplicate ${name} screen`,
      openScreen: (name, state, meta) => `Open ${name} screen, ${state}, ${meta}`,
      ready: "Ready",
      renameActiveScreen: "Rename active screen",
      renameScreen: (name) => `Rename ${name} screen`,
      screenCount: (count) => `${count} ${count === 1 ? "screen" : "screens"}`,
      screenNamePlaceholder: "Screen name",
      title: "Screens",
      uniqueNames: "Screen names should be unique.",
      widgetCount: (count) => `${count} ${count === 1 ? "widget" : "widgets"}`
    },
    toolbar: {
      applicationMenus: "Application menus",
      build: "Build",
      buildCExport: "Build C export",
      buildCExportSignedOut: "Login to Build",
      building: "Building...",
      cloudProjectCount: (count) => `${count} cloud ${count === 1 ? "project" : "projects"}`,
      copy: "Copy",
      copySelectedWidget: "Copy selected widget",
      copyWidget: (name) => `Copy ${name} widget`,
      createCloudProject: "Create cloud project",
      currentProject: (name) => `Current: ${name}`,
      delete: "Delete",
      deleteSelectedWidget: "Delete selected widget",
      deleteWidget: (name) => `Delete ${name} widget`,
      demo: "Demo",
      demoAccountConnected: "Demo account connected",
      demoLogin: "Demo login",
      edit: "Edit",
      editorLanguage: "Editor language",
      email: "Email",
      emailForCloudLogin: "Email for cloud login",
      export: "Export",
      file: "File",
      gridDisabled: "Grid disabled",
      gridEnabled: "Grid enabled",
      gridHide: "Hide grid",
      gridShow: "Show grid",
      help: "Help",
      hideSimulator: "Hide simulator",
      language: "Language",
      light: "Light",
      dark: "Dark",
      login: "Log in",
      loginFromProjectMenu: "Log in from project menu",
      loginToBuild: "Login to Build",
      loginWithDemoAccount: "Use demo account",
      logout: "Logout",
      menuOpen: (label) => `${label} menu open`,
      newProject: "New Project",
      newProjectA11y: "New project",
      noCloudProjects: "No cloud projects loaded yet.",
      open: "Open",
      openCloudProject: "Open cloud project",
      openCloudProjectFromMenu: "Open cloud project from menu",
      openMenu: (label) => `Open ${label} menu`,
      openProjectMenu: "Open project menu",
      openTargetSettingsFor: (targetLabel) => `Open target settings for ${targetLabel}`,
      productName: "LVGL Online Editor",
      localeNames: {
        "en-US": "EN",
        "zh-CN": "中文"
      },
      password: "Password",
      passwordForCloudLogin: "Password for cloud login",
      paste: "Paste",
      pasteCopiedWidget: "Paste copied widget",
      pasteWidget: (name) => `Paste ${name} widget`,
      preview: "Preview",
      previewBeforeExport: "Preview before export",
      previewCurrentScreen: "Preview current screen",
      project: "Project",
      projectMenuOpen: "Project menu open",
      projectName: "Project name",
      projectTheme: "Project theme",
      refreshCloudProjects: "Refresh cloud projects",
      redo: "Redo",
      saveProject: (name) => `Save ${name} project`,
      saveProjectMenu: "Save project",
      save: "Save",
      signInToBuild: "Sign in to build and export LVGL C code",
      showSimulator: "Show simulator",
      simulator: "Simulator",
      simulatorShow: "Show simulator",
      snapDisable: "Disable snap",
      snapDisabled: "Snap disabled",
      snapEnabled: "Snap enabled",
      snapEnable: "Enable snap",
      target: "Target",
      targetSettings: "Target settings",
      theme: "Theme",
      tools: "Tools",
      undo: "Undo",
      view: "View"
    }
  },
  "zh-CN": {
    assets: {
      allAssets: "全部资源",
      assetFilter: "资源筛选",
      assetsTab: "资源",
      bindButton: "绑定到图片",
      bindHint: "请选择一个未锁定的图片控件来绑定此资源。",
      bindImage: (name) => `将 ${name} 绑定到所选图片控件`,
      bindSelectedImage: "将所选资源绑定到图片控件",
      clearSearch: "清空资源搜索",
      columns: {
        name: "名称",
        size: "尺寸",
        type: "类型",
        use: "使用"
      },
      deleteAsset: (name) => `删除 ${name} 资源`,
      emptyAssets: "没有匹配的资源",
      emptyResources: "没有匹配的参考资源",
      filterResources: "筛选资源",
      filterPlaceholder: "筛选资源...",
      fonts: "字体",
      fontsTab: "字体",
      gridActive: "资源当前以网格显示",
      gridView: "以网格显示资源",
      images: "图片",
      importAsset: "导入资源",
      importReference: (name) => `导入 ${name} 参考资源`,
      importReferenceButton: "导入参考",
      importToBind: "导入后可绑定",
      listActive: "资源当前以列表显示",
      listView: "以列表显示资源",
      reference: "参考",
      referenceResource: "参考资源",
      resourceCount: (count) => `${count} 个资源`,
      resourceCategories: "资源分类",
      sampleMeta: (type, detail) => `${type} ${detail}`,
      selectReference: (name, type, meta) => `选择参考资源 ${name}，${type}，${meta}`,
      selectResource: (name, type, summary, usage) => `选择资源 ${name}，${type}，${summary}，${usage}`,
      selectedResource: "已选资源",
      showAssets: "显示资源",
      showFonts: "显示字体资源",
      title: "资源",
      typeFont: "字体",
      typeImage: "图片",
      unused: "未使用",
      used: (count) => `已使用 ${count}`
    },
    bottomDock: {
      build: "构建",
      buildLabel: "构建:",
      buildStatusLabels: {
        failed: "失败",
        idle: "空闲",
        queued: "排队中",
        running: "运行中",
        saving: "保存中",
        succeeded: "成功"
      },
      buildStatus: "构建状态",
      collapse: "折叠控制台、模拟器和构建面板",
      commandLabel: (label) => timelineCommandLabel(label, "zh-CN"),
      commandMessageLabel: (message) => timelineCommandMessageLabel(message, "zh-CN"),
      console: "控制台",
      downloadExport: (projectName) => `下载 ${projectName} LVGL C zip`,
      emptyConsole: "暂无控制台消息。",
      emptyTimeline: "暂无项目活动。",
      expand: "展开控制台、模拟器和构建面板",
      heightValue: (height) => `底部面板高度 ${height} 像素`,
      projectActivity: "项目活动",
      resize: "调整底部面板高度",
      resources: "资源",
      sections: "底部面板分区",
      timeline: "时间线",
      timelineColumns: {
        item: "项目",
        kind: "类型",
        status: "状态"
      },
      timelineKinds: {
        Command: "命令",
        Event: "事件",
        Screen: "屏幕"
      },
      timelineStatuses: {
        active: "当前",
        available: "可用",
        bound: "已绑定",
        done: "已完成",
        selected: "已选中",
        undone: "已撤销"
      },
      logColumns: {
        message: "消息",
        time: "时间"
      }
    },
    dialogs: {
      assetDeleteCancel: (name) => name ? `取消删除 ${name} 资源` : "取消删除资源",
      assetDeleteConfirm: (name) => name ? `删除 ${name} 资源` : "删除资源",
      assetDeleteDescription: (name, usageCount) => `${name} 正被 ${usageCount} 个资源引用使用。删除后这些资源引用会被清空。`,
      assetDeleteTitle: "删除已引用资源？",
      cancel: "取消",
      cancelNewProject: "取消创建云项目",
      createProject: "创建项目",
      createProjectNamed: (name) => name ? `创建 ${name} 云项目` : "创建云项目",
      newProjectDescription: "创建到云端存储前，请先为 LVGL 项目命名。",
      newProjectName: "项目名称",
      newProjectNameA11y: "云项目名称",
      newProjectTitle: "创建云项目"
    },
    canvas: {
      addReusableStyle: "新增可复用样式",
      addScreen: "从画布工具栏新增屏幕",
      apply: "应用",
      applyReusableStyle: (styleName, widgetName) => widgetName ? `将 ${styleName} 应用到 ${widgetName}` : `选择控件以应用 ${styleName}`,
      backToCanvas: (screenName) => `返回 ${screenName} 画布`,
      backToCanvasButton: "返回画布",
      background: "背景",
      canvas: "画布",
      canvasZoom: "画布缩放",
      code: "代码",
      colorDepth: "色深",
      colorDepthOption: (depth) => `${depth} 位`,
      copyCode: (fileName) => `复制 ${fileName} 的生成代码`,
      currentScreen: "当前屏幕",
      dark: "深色",
      deleteReusableStyle: (styleName) => `删除 ${styleName} 可复用样式`,
      device: "设备",
      fitView: (screenName) => `适配 ${screenName} 画布视图`,
      fullscreen: (screenName) => `全屏打开 ${screenName} 画布`,
      generatedSource: "生成源码",
      height: "高度",
      lineCount: (count) => `${count} 行`,
      light: "浅色",
      lvglVersion: "LVGL 版本",
      dpi: "DPI",
      openTargetSettings: (width, height) => `打开 ${width} x ${height} 的目标设置`,
      projectName: "项目名称",
      projectNameA11y: "项目名称",
      projectSettings: "项目设置",
      radius: "圆角",
      reusableStyleName: "可复用样式名称",
      reusableStyles: "可复用样式",
      noReusableStyles: "暂无可复用样式。",
      opacity: "透明度",
      save: "保存",
      screenFallback: "屏幕",
      settings: "设置",
      styleName: "样式名称",
      target: "目标",
      targetSummary: (target) => `${target.deviceName} / ${target.width} x ${target.height} · ${target.dpi} DPI · ${target.colorDepth} 位 · LVGL ${target.lvglVersion}`,
      textColor: "文字颜色",
      theme: "主题",
      width: "宽度"
    },
    previewRuntime: {
      capturePreviewScreenshot: (screenName) => `截取 ${screenName} 预览截图`,
      captureSimulatorScreenshot: (screenName) => `截取 ${screenName} 模拟器截图`,
      closePreview: (screenName) => `关闭 ${screenName} 预览`,
      currentScreen: "当前屏幕",
      devicePreview: "设备预览",
      downloadPreviewScreenshot: (screenName) => `下载 ${screenName} 预览截图`,
      downloadSimulatorScreenshot: (screenName) => `下载 ${screenName} 模拟器截图`,
      dropdownDefaultOptions: "选项 1\n选项 2",
      dropdownFallback: "下拉框",
      fullscreenSimulator: (screenName) => `全屏打开 ${screenName} 模拟器`,
      imageMissing: "缺少预览",
      openSimulatorFullscreen: (screenName) => `全屏打开 ${screenName} 模拟器`,
      preview: "预览",
      previewDevice: (screenName, targetLabel) => `${screenName} 在 ${targetLabel} 上的预览`,
      refreshPreview: (screenName) => `刷新 ${screenName} 预览`,
      refreshSimulator: (screenName) => `刷新 ${screenName} 模拟器`,
      resizeWidget: (name) => `调整 ${name} 控件尺寸`,
      runtimeKinds: {
        canvas: "画布回退",
        unknown: "运行时待加载",
        wasm: "LVGL WASM"
      },
      runtimeMode: (kind) => `模拟器运行时：${kind}`,
      selectAsset: "选择资源",
      selectWidget: (name, type) => `选择并拖拽 ${name} ${type} 控件`,
      simulator: "模拟器",
      simulatorStatus: (status) => `模拟器状态：${status}`,
      switchSimulatorDark: "切换模拟器为深色背景",
      switchSimulatorLight: "切换模拟器为浅色背景"
    },
    status: {
      autosave: "自动保存",
      cloudProjectNotCreated: "云项目尚未创建",
      cloudSaveUnavailable: "云端保存不可用",
      editorReady: "编辑器就绪",
      localProject: "本地项目",
      projectSavedToCloud: "项目已保存到云端",
      saveFailed: "保存失败",
      saving: "保存中...",
      coordinates: (x, y) => `X: ${x} Y: ${y}`,
      dpi: (dpi) => `DPI：${dpi}`,
      lvglVersion: (version) => `LVGL v${version}`,
      saveStatus: (state) => `保存状态：${state}`,
      signedOutLocalEditing: "已退出登录，本地编辑仍可继续",
      unsavedChanges: "有未保存更改",
      allChangesSaved: "所有更改已保存"
    },
    runtime: {
      assetBoundFromPanel: "已从资源面板绑定图片资源",
      assetDeleted: (name) => `资源已删除：${name}`,
      assetUploadSaveFailed: "项目保存失败，资源上传已停止",
      assetImportedLocally: (name) => `资源已本地导入：${name}`,
      assetUploaded: (name) => `资源已上传：${name}`,
      buildDirtyAfterSave: "检测到新的未保存更改，构建已停止",
      buildFailed: "构建失败",
      buildSaveFailed: "项目保存失败，构建已停止",
      buildSignInRequired: "请先登录并创建云项目，再构建导出 LVGL C 代码",
      canvasFullscreenFailed: "画布全屏失败",
      canvasFullscreenFailedWithMessage: (message) => `画布全屏失败：${message}`,
      canvasFullscreenOpened: "画布已全屏打开",
      canvasFullscreenUnavailable: "当前浏览器不支持画布全屏",
      codeCopied: "代码已复制",
      codeCopyFailed: "复制失败",
      codeCopyFailedWithMessage: (message) => `复制代码失败：${message}`,
      clipboardApiUnavailable: "当前浏览器不支持剪贴板写入",
      clipboardWriteTimedOut: "剪贴板写入超时",
      copyingCode: "正在复制...",
      downloadUnavailable: "当前浏览器不支持下载",
      exportDownloadFailed: "导出包下载失败",
      exportZipDownloaded: "导出 zip 已下载",
      generatedCodeCopied: "生成代码已复制到剪贴板",
      imageAssetSelectRequired: "请先选择一个未锁定的图片控件再绑定资源",
      jobLogMessage: (message) => jobLogMessage(message, "zh-CN"),
      jobStatus: (status) => `任务状态：${jobStatusLabel(status, "zh-CN")}`,
      jobTimedOut: (pollLimit) => `导出任务轮询 ${pollLimit} 次后超时`,
      loadingRuntime: "正在加载 runtime",
      loggedInAs: (name) => `已登录：${name}`,
      loginFailed: (message) => `登录失败：${message}`,
      noCodeToCopy: "没有可复制的代码",
      codegenBlockedInvalidAssetKind: (assetId) => `代码生成已阻断：图片控件必须引用图片资源 ${assetId}`,
      codegenBlockedInvalidFontAssetKind: (assetId) => `代码生成已阻断：字体样式必须引用字体资源 ${assetId}`,
      codegenBlockedMissingAsset: (assetId) => `代码生成已阻断：缺少图片资源 ${assetId}`,
      codegenBlockedMissingFontAsset: (assetId) => `代码生成已阻断：缺少字体资源 ${assetId}`,
      previewFailed: "预览失败",
      previewEventTriggered: (eventName, handlerName) => `预览事件 ${eventName} -> ${handlerName}`,
      previewInteractionTemporary: "预览交互仅为临时模拟。截图前请刷新预览。",
      previewLiveReady: "实时预览就绪",
      previewRefreshed: "预览已刷新",
      previewScreenshotLogReady: "预览截图已准备好",
      previewScreenshotReady: "截图已准备好",
      previewScreenshotUnavailable: "截图不可用",
      previewUpdated: "预览已更新",
      projectCreateFailed: "项目创建失败",
      projectCreated: "项目已创建",
      projectListFailed: "项目列表加载失败",
      projectListLoaded: "项目列表已加载",
      projectNameRequired: "项目名称必填",
      projectOpened: "项目已打开",
      projectOpenFailed: "项目打开失败",
      projectSaved: "项目已保存",
      projectSaveFailed: (message) => `项目保存失败：${message}`,
      renderScreen: (screenName) => `正在渲染 ${screenName}`,
      readyToCopy: "准备复制",
      runtimeLoadFailed: "Runtime 加载失败",
      selectImageWidgetBeforeBinding: "请先选择一个未锁定的图片控件再绑定资源",
      signInBeforeAssets: "请先登录再上传资源",
      signInBeforeAssetsError: "请先登录再上传资源",
      signInBeforeCloudProjects: "请先登录再创建云项目",
      signInBeforeLoadingProjects: "请先登录再加载云项目",
      simulatorBackground: (background) => `模拟器背景已切换为${background === "dark" ? "深色" : "浅色"}`,
      simulatorFullscreenFailed: "模拟器全屏失败",
      simulatorFullscreenFailedWithMessage: (message) => `模拟器全屏失败：${message}`,
      simulatorFullscreenOpened: "模拟器已全屏打开",
      simulatorFullscreenUnavailable: "当前浏览器不支持模拟器全屏",
      simulatorHidden: "模拟器已隐藏",
      simulatorLoaded: "模拟器已加载",
      simulatorRefreshed: "模拟器已刷新",
      simulatorScreenshotReady: "模拟器截图已准备好",
      simulatorScreenshotUnavailable: "模拟器截图不可用",
      unknownError: "未知错误",
      untitledProjectName: "未命名 LVGL UI"
    },
    inspector: {
      addEvent: "添加事件",
      addEventToTarget: (eventName, targetName) => `为 ${targetName} 添加 ${eventName} 事件`,
      a11y: {
        eventHandler: "事件处理函数",
        eventTarget: "事件目标",
        eventType: "事件类型",
        backgroundColor: "背景颜色",
        blendMode: "混合模式",
        borderColor: "边框颜色",
        chartPointCount: "图表点数量",
        chartValues: "图表数值",
        dropdownOptions: "下拉选项",
        flexDirection: "Flex 方向",
        flexGap: "Flex 间距",
        flexWrap: "Flex 换行",
        imageAsset: "图片资源",
        layoutHeight: "布局高度",
        layoutX: "布局 X 坐标",
        layoutY: "布局 Y 坐标",
        layoutWidth: "布局宽度",
        maximumValue: "最大值",
        minimumValue: "最小值",
        selectedWidgetText: "所选控件文本",
        checkboxText: "复选框文本",
        layoutAlignment: "布局对齐",
        arcLength: "弧长",
        letterSpacing: "字距",
        lineSpacing: "行距",
        paddingBottom: "下内边距",
        paddingLeft: "左内边距",
        paddingRight: "右内边距",
        paddingTop: "上内边距",
        selectedOptionIndex: "选中项索引",
        spinTime: "旋转时间",
        targetColorDepth: "目标色深",
        targetDeviceName: "目标设备名称",
        targetDpi: "目标 DPI",
        targetHeight: "目标高度",
        targetLvglVersion: "目标 LVGL 版本",
        targetWidth: "目标宽度",
        textAlignment: "文本对齐",
        textColor: "文本颜色",
        textFont: "文本字体",
        value: "当前值"
      },
      asset: "资源",
      boundToAsset: (name) => `已绑定 ${name}`,
      colorPreview: (label, value) => `${label}预览 ${value}`,
      columns: {
        action: "操作",
        event: "事件",
        handler: "处理函数",
        target: "目标"
      },
      emptyBody: "从画布或图层中选择一个控件后，可编辑检查器、事件和布局。",
      emptyTitle: "未选择控件",
      enterHandler: (eventName, targetName) => `输入处理函数后为 ${targetName} 添加 ${eventName} 事件`,
      eventEmpty: "当前选择没有绑定事件。",
      fontAssetWarning: (font) => `未知字体资源或不支持的 LVGL 字体符号：${font}`,
      fontAssetExportNote: "V1 中上传字体仅作为元数据保存。导出 C 代码前请使用内置 lv_font_* 符号，或先将字体转换为 LVGL 字体符号。",
      imageAssetMissing: "已选图片资源不在当前项目中。",
      imageAssetNone: "未选择图片资源。",
      imageAssetNotImported: "尚未导入图片资源。请在资源面板点击 + 导入。",
      removeEvent: (eventName, targetName, handlerName) => `移除 ${targetName} 上由 ${handlerName} 处理的 ${eventName} 事件`,
      sections: {
        appearance: "外观",
        events: "事件",
        image: "图片",
        layout: "布局",
        props: "属性",
        selector: "选择器",
        target: "目标",
        text: "文本"
      },
      selectedWidget: "所选控件",
      selectedWidgetName: "所选控件名称",
      tabs: {
        events: "事件",
        inspector: "检查器",
        layout: "布局"
      },
      tabSections: "检查器分区",
      unlockToAddEvents: (targetName) => `解锁 ${targetName} 后才能添加事件`,
      errors: {
        chartValuesInvalid: "数值必须使用逗号、空格或换行分隔，且全部为数字",
        chartValuesRequired: "至少需要输入一个数值",
        deviceNameRequired: "设备名称不能为空",
        greaterThanZero: (field) => `${field}必须大于 0`,
        greaterThan: (field, comparison) => `${field}必须大于${comparison}`,
        hexColor: (field) => `${field}必须是 3 位或 6 位十六进制颜色`,
        integer: (field) => `${field}必须是整数`,
        nonNegative: (field) => `${field}不能为负数`,
        number: (field) => `${field}必须是数字`,
        range: (field, min, max) => `${field}必须在 ${min} 到 ${max} 之间`
      },
      fields: {
        align: "对齐",
        arcLength: "弧长",
        background: "背景",
        blendMode: "混合模式",
        border: "边框",
        checked: "选中",
        colorDepth: "色深",
        default: "默认",
        device: "设备",
        event: "事件",
        flexDirection: "Flex 方向",
        font: "字体",
        gap: "间距",
        handler: "处理函数",
        height: "高度",
        imageNone: "无",
        letterSpace: "字距",
        lineSpace: "行距",
        max: "最大值",
        min: "最小值",
        opacity: "透明度",
        options: "选项",
        paddingBottom: "下内边距",
        paddingLeft: "左内边距",
        paddingRight: "右内边距",
        paddingTop: "上内边距",
        pointCount: "点数量",
        radius: "圆角",
        selected: "选中项",
        spinTime: "旋转时间",
        target: "目标",
        text: "文本",
        textColor: "文本颜色",
        value: "当前值",
        values: "数值",
        width: "宽度",
        wrap: "换行"
      },
      options: {
        blendMode: {
          additive: "叠加",
          multiply: "正片叠底",
          normal: "正常",
          replace: "替换",
          subtractive: "减去"
        },
        flexDirection: {
          column: "纵向",
          row: "横向"
        },
        layoutAlign: {
          "bottom-left": "左下",
          "bottom-right": "右下",
          center: "居中",
          "top-left": "左上",
          "top-right": "右上"
        },
        textAlign: {
          center: "居中",
          left: "左对齐",
          right: "右对齐"
        }
      }
    },
    navigation: {
      code: "代码",
      editorSections: "编辑器分区",
      inspector: "检查器",
      layers: "图层",
      resources: "资源",
      screens: "屏幕",
      selectedSection: (label) => `${label}已选中`,
      settings: "设置",
      widgets: "控件",
      openSection: (label) => `打开${label}`
    },
    widgets: {
      addWidget: (label) => `添加 ${label} 控件`,
      clearSearch: "清空控件搜索",
      emptySearch: (query) => `没有匹配 "${query}" 的控件。`,
      resultCount: (count) => `${count} 个控件`,
      search: "搜索控件",
      searchPlaceholder: "搜索控件...",
      title: "控件",
      categories: {
        Advanced: "高级",
        Basic: "基础",
        Charts: "图表",
        Containers: "容器",
        Indicators: "指示器",
        Inputs: "输入",
      },
      names: {
        arc: "圆弧",
        bar: "进度条",
        button: "按钮",
        chart: "图表",
        checkbox: "复选框",
        container: "容器",
        dropdown: "下拉框",
        image: "图片",
        label: "文本",
        line: "线条",
        slider: "滑块",
        spinner: "加载圈",
        switch: "开关"
      }
    },
    layers: {
      clearSearch: "清空图层搜索",
      columnObject: "对象",
      columnState: "状态",
      columnTools: "工具",
      deleteLayer: (name) => `删除 ${name} 图层`,
      empty: "当前屏幕没有控件。可从控件面板添加，或拖放到画布。",
      hidden: "隐藏",
      hideLayer: (name) => `隐藏 ${name} 图层`,
      layerCount: (count) => `${count} 个图层`,
      layerHidden: "图层已隐藏",
      layerVisible: "图层可见",
      locked: "锁定",
      lockLayer: (name) => `锁定 ${name} 图层`,
      moveLayer: (name, direction) => `将 ${name} 图层${direction === "up" ? "上移" : "下移"}`,
      noSearchResults: "没有匹配的图层。",
      renameLayer: (name) => `重命名 ${name} 图层`,
      screenFallback: "屏幕",
      screenType: "屏幕",
      search: "搜索图层",
      searchPlaceholder: "搜索图层...",
      selectLayer: (name, type) => `选择 ${name} ${type} 图层`,
      selectScreenRoot: (name) => `选择屏幕根节点 ${name}`,
      showLayer: (name) => `显示 ${name} 图层`,
      title: "图层",
      unlockLayer: (name) => `解锁 ${name} 图层`
    },
    screens: {
      active: "当前",
      add: "新增屏幕",
      columnScreen: "屏幕",
      columnState: "状态",
      columnWidgets: "控件",
      createScreen: (name, state, meta) => `创建 ${name} 屏幕，${state}，${meta}`,
      delete: "删除屏幕",
      deleteScreen: (name) => `删除 ${name} 屏幕`,
      draft: "草稿",
      duplicate: "复制屏幕",
      duplicateScreen: (name) => `复制 ${name} 屏幕`,
      openScreen: (name, state, meta) => `打开 ${name} 屏幕，${state}，${meta}`,
      ready: "就绪",
      renameActiveScreen: "重命名当前屏幕",
      renameScreen: (name) => `重命名 ${name} 屏幕`,
      screenCount: (count) => `${count} 个屏幕`,
      screenNamePlaceholder: "屏幕名称",
      title: "屏幕",
      uniqueNames: "屏幕名称建议保持唯一。",
      widgetCount: (count) => `${count} 个控件`
    },
    toolbar: {
      applicationMenus: "应用菜单",
      build: "构建",
      buildCExport: "构建 C 导出",
      buildCExportSignedOut: "登录后构建",
      building: "构建中...",
      cloudProjectCount: (count) => `${count} 个云项目`,
      copy: "复制",
      copySelectedWidget: "复制所选控件",
      copyWidget: (name) => `复制 ${name} 控件`,
      createCloudProject: "创建云项目",
      currentProject: (name) => `当前：${name}`,
      delete: "删除",
      deleteSelectedWidget: "删除所选控件",
      deleteWidget: (name) => `删除 ${name} 控件`,
      demo: "演示",
      demoAccountConnected: "演示账号已连接",
      demoLogin: "演示登录",
      edit: "编辑",
      editorLanguage: "编辑器语言",
      email: "邮箱",
      emailForCloudLogin: "云登录邮箱",
      export: "导出",
      file: "文件",
      gridDisabled: "网格已关闭",
      gridEnabled: "网格已开启",
      gridHide: "隐藏网格",
      gridShow: "显示网格",
      help: "帮助",
      hideSimulator: "隐藏模拟器",
      language: "语言",
      light: "浅色",
      dark: "深色",
      login: "登录",
      loginFromProjectMenu: "从项目菜单登录",
      loginToBuild: "登录后构建",
      loginWithDemoAccount: "使用演示账号登录",
      logout: "退出登录",
      menuOpen: (label) => `${label}菜单已打开`,
      newProject: "新建项目",
      newProjectA11y: "新建项目",
      noCloudProjects: "尚未加载云项目。",
      open: "打开",
      openCloudProject: "打开云项目",
      openCloudProjectFromMenu: "从菜单打开云项目",
      openMenu: (label) => `打开${label}菜单`,
      openProjectMenu: "打开项目菜单",
      openTargetSettingsFor: (targetLabel) => `打开 ${targetLabel} 的目标设置`,
      productName: "LVGL 在线编辑器",
      localeNames: {
        "en-US": "EN",
        "zh-CN": "中文"
      },
      password: "密码",
      passwordForCloudLogin: "云登录密码",
      paste: "粘贴",
      pasteCopiedWidget: "粘贴已复制控件",
      pasteWidget: (name) => `粘贴 ${name} 控件`,
      preview: "预览",
      previewBeforeExport: "导出前预览",
      previewCurrentScreen: "预览当前屏幕",
      project: "项目",
      projectMenuOpen: "项目菜单已打开",
      projectName: "项目名称",
      projectTheme: "项目主题",
      refreshCloudProjects: "刷新云项目",
      redo: "重做",
      saveProject: (name) => `保存 ${name} 项目`,
      saveProjectMenu: "保存项目",
      save: "保存",
      signInToBuild: "登录后构建并导出 LVGL C 代码",
      showSimulator: "显示模拟器",
      simulator: "模拟器",
      simulatorShow: "显示模拟器",
      snapDisable: "关闭吸附",
      snapDisabled: "吸附已关闭",
      snapEnabled: "吸附已开启",
      snapEnable: "启用吸附",
      target: "目标",
      targetSettings: "目标设置",
      theme: "主题",
      tools: "工具",
      undo: "撤销",
      view: "视图"
    }
  }
};

export function isLocale(value: string): value is Locale {
  return value === "en-US" || value === "zh-CN";
}

function jobStatusLabel(status: string, locale: Locale): string {
  const labels: Record<Locale, Record<string, string>> = {
    "en-US": {
      queued: "queued",
      running: "running",
      succeeded: "succeeded",
      failed: "failed"
    },
    "zh-CN": {
      queued: "排队中",
      running: "运行中",
      succeeded: "成功",
      failed: "失败"
    }
  };
  return labels[locale][status] ?? status;
}

function jobLogMessage(message: string, locale: Locale): string {
  const messages: Record<Locale, Record<string, string>> = {
    "en-US": {
      "Build started": "Build started",
      "Generating code": "Generating code",
      "Job running": "Job running",
      "Build completed successfully": "Build completed successfully"
    },
    "zh-CN": {
      "Build started": "构建已开始",
      "Generating code": "正在生成代码",
      "Job running": "任务运行中",
      "Build completed successfully": "构建成功完成"
    }
  };
  return messages[locale][message] ?? message;
}

function timelineCommandLabel(label: string, locale: Locale): string {
  if (locale === "en-US") {
    return label;
  }
  if (label.startsWith("Add ")) {
    return `添加 ${label.slice(4)}`;
  }
  const labels: Record<string, string> = {
    "Add event binding": "添加事件绑定",
    "Add screen": "新增屏幕",
    "Delete screen": "删除屏幕",
    "Delete widget": "删除控件",
    "Duplicate screen": "复制屏幕",
    "Move widget": "移动控件",
    "Move widget in layers": "移动图层控件",
    "Register asset": "注册资源",
    "Remove event binding": "移除事件绑定",
    "Rename project": "重命名项目",
    "Rename screen": "重命名屏幕",
    "Reorder widget": "调整控件层级",
    "Resize widget": "调整控件尺寸",
    "Unregister asset": "注销资源",
    "Update project styles": "更新项目样式",
    "Update target": "更新目标",
    "Update theme": "更新主题",
    "Update widget layout": "更新控件布局",
    "Update widget metadata": "更新控件元数据",
    "Update widget props": "更新控件属性",
    "Update widget style": "更新控件样式"
  };
  return labels[label] ?? label;
}

function timelineCommandMessageLabel(message: EditorCommandMessage, locale: Locale): string {
  if (message.key === "addWidget") {
    const widgetName = editorCopy[locale].widgets.names[message.widgetType as keyof typeof editorCopy["en-US"]["widgets"]["names"]] ?? message.widgetType;
    return editorCopy[locale].widgets.addWidget(widgetName);
  }
  const labels: Record<Locale, Record<Exclude<EditorCommandMessage["key"], "addWidget">, string>> = {
    "en-US": {
      addEventBinding: "Add event binding",
      addScreen: "Add screen",
      deleteScreen: "Delete screen",
      deleteWidget: "Delete widget",
      duplicateScreen: "Duplicate screen",
      moveWidget: "Move widget",
      moveWidgetInLayers: "Move widget in layers",
      registerAsset: "Register asset",
      removeEventBinding: "Remove event binding",
      renameProject: "Rename project",
      renameScreen: "Rename screen",
      reorderWidget: "Reorder widget",
      resizeWidget: "Resize widget",
      updateProjectStyles: "Update project styles",
      updateTarget: "Update target",
      updateTheme: "Update theme",
      updateWidgetLayout: "Update widget layout",
      updateWidgetMetadata: "Update widget metadata",
      updateWidgetProps: "Update widget props",
      updateWidgetStyle: "Update widget style",
      unregisterAsset: "Unregister asset"
    },
    "zh-CN": {
      addEventBinding: "添加事件绑定",
      addScreen: "新增屏幕",
      deleteScreen: "删除屏幕",
      deleteWidget: "删除控件",
      duplicateScreen: "复制屏幕",
      moveWidget: "移动控件",
      moveWidgetInLayers: "移动图层控件",
      registerAsset: "注册资源",
      removeEventBinding: "移除事件绑定",
      renameProject: "重命名项目",
      renameScreen: "重命名屏幕",
      reorderWidget: "调整控件层级",
      resizeWidget: "调整控件尺寸",
      updateProjectStyles: "更新项目样式",
      updateTarget: "更新目标",
      updateTheme: "更新主题",
      updateWidgetLayout: "更新控件布局",
      updateWidgetMetadata: "更新控件元数据",
      updateWidgetProps: "更新控件属性",
      updateWidgetStyle: "更新控件样式",
      unregisterAsset: "注销资源"
    }
  };
  return labels[locale][message.key];
}
