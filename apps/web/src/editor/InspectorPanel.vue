<template>
  <aside class="inspector-panel panel">
    <div class="tabs" role="tablist" aria-label="Inspector sections">
      <button
        class="tab"
        :class="{ active: activeInspectorTab === 'style' }"
        ref="styleTabRef"
        data-testid="inspector-style-tab"
        type="button"
        role="tab"
        :aria-selected="activeInspectorTab === 'style' ? 'true' : 'false'"
        :tabindex="activeInspectorTab === 'style' ? 0 : -1"
        @click="emit('update:active-inspector-tab', 'style')"
        @keydown="handleInspectorTabKeydown($event, 'style')"
      >
        Inspector
      </button>
      <button
        class="tab"
        :class="{ active: activeInspectorTab === 'events' }"
        ref="eventsTabRef"
        data-testid="inspector-events-tab"
        type="button"
        role="tab"
        :aria-selected="activeInspectorTab === 'events' ? 'true' : 'false'"
        :tabindex="activeInspectorTab === 'events' ? 0 : -1"
        @click="emit('update:active-inspector-tab', 'events')"
        @keydown="handleInspectorTabKeydown($event, 'events')"
      >
        Events
      </button>
      <button
        class="tab"
        :class="{ active: activeInspectorTab === 'layout' }"
        ref="layoutTabRef"
        data-testid="inspector-layout-tab"
        type="button"
        role="tab"
        :aria-selected="activeInspectorTab === 'layout' ? 'true' : 'false'"
        :tabindex="activeInspectorTab === 'layout' ? 0 : -1"
        @click="emit('update:active-inspector-tab', 'layout')"
        @keydown="handleInspectorTabKeydown($event, 'layout')"
      >
        Layout
      </button>
    </div>
    <section v-if="!selectedWidget" class="inspector-section inspector-empty" data-testid="inspector-empty-state" role="status" aria-live="polite" aria-atomic="true">
      <h2>No widget selected</h2>
      <p>Select a widget from Canvas or Layers to edit Inspector, Events and Layout.</p>
    </section>
    <section v-else class="inspector-section">
      <h2>Selector</h2>
      <input
        data-testid="selector-input"
        aria-label="Selected widget name"
        title="Selected widget name"
        :disabled="selectedWidget?.locked"
        :value="selectedWidget?.name"
        @input="emitInput('rename-widget', $event)"
      />
    </section>
    <section v-if="activeInspectorTab === 'style' && canEditText" class="inspector-section">
      <h2>Text</h2>
      <label>
        Text
        <input
          data-testid="selected-text-input"
          aria-label="Selected widget text"
          title="Selected widget text"
          :disabled="selectedWidget?.locked"
          :value="selectedText"
          @input="emitInput('update-text', $event)"
        />
      </label>
      <label>
        Font
        <select data-testid="style-font-select" aria-label="Text font" title="Text font" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.font ?? ''" @change="emitInput('update-style-font', $event)">
          <option value="">Default</option>
          <option value="lv_font_montserrat_14">lv_font_montserrat_14</option>
          <option value="lv_font_montserrat_20">lv_font_montserrat_20</option>
          <option value="lv_font_montserrat_32">lv_font_montserrat_32</option>
          <option value="lv_font_montserrat_48">lv_font_montserrat_48</option>
          <option v-for="asset in fontAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
        </select>
      </label>
      <label>
        Align
        <select data-testid="style-align-select" aria-label="Text alignment" title="Text alignment" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.align ?? 'left'" @change="emitInput('update-style-align', $event)">
          <option value="left">left</option>
          <option value="center">center</option>
          <option value="right">right</option>
        </select>
      </label>
    </section>
    <section v-if="activeInspectorTab === 'style' && hasRangeProps" class="inspector-section">
      <h2>Props</h2>
      <label>Min<input data-testid="prop-min-input" type="number" aria-label="Minimum value" title="Minimum value" step="1" :disabled="selectedWidget?.locked" :value="propNumber('min', 0)" @input="emitFieldInput('update-prop-number', 'min', $event)" /></label>
      <label>Max<input data-testid="prop-max-input" type="number" aria-label="Maximum value" title="Maximum value" step="1" :disabled="selectedWidget?.locked" :value="propNumber('max', 100)" @input="emitFieldInput('update-prop-number', 'max', $event)" /></label>
      <label>Value<input data-testid="prop-value-input" type="number" aria-label="Current value" title="Current value" step="1" :disabled="selectedWidget?.locked" :value="propNumber('value', 0)" :aria-invalid="inspectorErrors['prop-value'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-value'] ? 'prop-value-error' : undefined" @input="emitFieldInput('update-prop-number', 'value', $event)" /></label>
      <p v-if="inspectorErrors['prop-value']" id="prop-value-error" class="field-error" data-testid="prop-value-error" role="alert">{{ inspectorErrors['prop-value'] }}</p>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'chart'" class="inspector-section">
      <h2>Props</h2>
      <label>Min<input data-testid="prop-min-input" type="number" aria-label="Minimum value" title="Minimum value" step="1" :disabled="selectedWidget?.locked" :value="propNumber('min', 0)" @input="emitFieldInput('update-prop-number', 'min', $event)" /></label>
      <label>Max<input data-testid="prop-max-input" type="number" aria-label="Maximum value" title="Maximum value" step="1" :disabled="selectedWidget?.locked" :value="propNumber('max', 100)" @input="emitFieldInput('update-prop-number', 'max', $event)" /></label>
      <label>Point Count<input data-testid="prop-point-count-input" type="number" aria-label="Chart point count" title="Chart point count" min="1" step="1" :disabled="selectedWidget?.locked" :value="propNumber('pointCount', 8)" :aria-invalid="inspectorErrors['prop-point-count'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-point-count'] ? 'prop-point-count-error' : undefined" @input="emitFieldInput('update-prop-number', 'pointCount', $event)" /></label>
      <p v-if="inspectorErrors['prop-point-count']" id="prop-point-count-error" class="field-error" data-testid="prop-point-count-error" role="alert">{{ inspectorErrors['prop-point-count'] }}</p>
      <label>Values<textarea data-testid="prop-values-input" aria-label="Chart values" title="Chart values" :disabled="selectedWidget?.locked" :value="propValues()" :aria-invalid="inspectorErrors['prop-values'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-values'] ? 'prop-values-error' : undefined" @input="emit('update-prop-values', inputValue($event))" /></label>
      <p v-if="inspectorErrors['prop-values']" id="prop-values-error" class="field-error" data-testid="prop-values-error" role="alert">{{ inspectorErrors['prop-values'] }}</p>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'spinner'" class="inspector-section">
      <h2>Props</h2>
      <label>Spin Time<input data-testid="prop-spin-time-input" type="number" aria-label="Spin time" title="Spin time" min="1" step="1" :disabled="selectedWidget?.locked" :value="propNumber('spinTime', 1000)" :aria-invalid="inspectorErrors['prop-spin-time'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-spin-time'] ? 'prop-spin-time-error' : undefined" @input="emitFieldInput('update-prop-number', 'spinTime', $event)" /></label>
      <p v-if="inspectorErrors['prop-spin-time']" id="prop-spin-time-error" class="field-error" data-testid="prop-spin-time-error" role="alert">{{ inspectorErrors['prop-spin-time'] }}</p>
      <label>Arc Length<input data-testid="prop-arc-length-input" type="number" aria-label="Arc length" title="Arc length" min="1" step="1" :disabled="selectedWidget?.locked" :value="propNumber('arcLength', 60)" :aria-invalid="inspectorErrors['prop-arc-length'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-arc-length'] ? 'prop-arc-length-error' : undefined" @input="emitFieldInput('update-prop-number', 'arcLength', $event)" /></label>
      <p v-if="inspectorErrors['prop-arc-length']" id="prop-arc-length-error" class="field-error" data-testid="prop-arc-length-error" role="alert">{{ inspectorErrors['prop-arc-length'] }}</p>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'switch'" class="inspector-section">
      <h2>Props</h2>
      <label><input data-testid="prop-checked-input" type="checkbox" aria-label="Checked" title="Checked" :disabled="selectedWidget?.locked" :checked="selectedWidget?.props.checked === true" @change="emit('update-prop-checked', ($event.target as HTMLInputElement).checked)" /> Checked</label>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'checkbox'" class="inspector-section">
      <h2>Props</h2>
      <label>Text<input data-testid="prop-text-input" aria-label="Checkbox text" title="Checkbox text" :disabled="selectedWidget?.locked" :value="propString('text')" @input="emitFieldInput('update-prop-text', 'text', $event)" /></label>
      <label><input data-testid="prop-checked-input" type="checkbox" aria-label="Checked" title="Checked" :disabled="selectedWidget?.locked" :checked="selectedWidget?.props.checked === true" @change="emit('update-prop-checked', ($event.target as HTMLInputElement).checked)" /> Checked</label>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'dropdown'" class="inspector-section">
      <h2>Props</h2>
      <label>Options<textarea data-testid="prop-options-input" aria-label="Dropdown options" title="Dropdown options" :disabled="selectedWidget?.locked" :value="propString('options')" @input="emitFieldInput('update-prop-text', 'options', $event)" /></label>
      <label>Selected<input data-testid="prop-selected-input" type="number" aria-label="Selected option index" title="Selected option index" min="0" step="1" :disabled="selectedWidget?.locked" :value="propNumber('selected', 0)" :aria-invalid="inspectorErrors['prop-selected'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-selected'] ? 'prop-selected-error' : undefined" @input="emitFieldInput('update-prop-number', 'selected', $event)" /></label>
      <p v-if="inspectorErrors['prop-selected']" id="prop-selected-error" class="field-error" data-testid="prop-selected-error" role="alert">{{ inspectorErrors['prop-selected'] }}</p>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'image'" class="inspector-section">
      <h2>Image</h2>
      <label>
        Asset
        <select
          data-testid="image-asset-select"
          aria-label="Image asset"
          title="Image asset"
          :value="selectedWidget?.props.assetId ?? ''"
          :disabled="selectedWidget?.locked"
          @change="emitInput('bind-image-asset', $event)"
        >
          <option value="">None</option>
          <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">
            {{ asset.name }}
          </option>
        </select>
      </label>
      <p
        class="asset-binding-state"
        :class="{ warning: imageBindingState.tone === 'warning', success: imageBindingState.tone === 'success' }"
        data-testid="image-binding-state"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ imageBindingState.message }}
      </p>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget" class="inspector-section">
      <h2>Appearance</h2>
      <label class="color-field">
        Text Color
        <span class="color-control">
          <span
            class="color-swatch"
            data-testid="style-text-color-swatch"
            role="img"
            :aria-label="colorPreviewLabel('Text color', selectedWidget?.style.textColor, '#FFFFFF')"
            :title="colorPreviewLabel('Text color', selectedWidget?.style.textColor, '#FFFFFF')"
            :style="{ backgroundColor: selectedWidget?.style.textColor ?? '#FFFFFF' }"
          />
          <input data-testid="style-text-color-input" aria-label="Text color" title="Text color" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.textColor ?? '#FFFFFF'" @input="emitStyleText('textColor', $event)" />
        </span>
      </label>
      <label class="color-field">
        Background
        <span class="color-control">
          <span
            class="color-swatch"
            data-testid="style-bg-color-swatch"
            role="img"
            :aria-label="colorPreviewLabel('Background color', selectedWidget?.style.bgColor, 'transparent')"
            :title="colorPreviewLabel('Background color', selectedWidget?.style.bgColor, 'transparent')"
            :style="{ backgroundColor: selectedWidget?.style.bgColor || 'transparent' }"
          />
          <input data-testid="style-bg-color-input" aria-label="Background color" title="Background color" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.bgColor ?? ''" @input="emitStyleText('bgColor', $event)" />
        </span>
      </label>
      <label class="color-field">
        Border
        <span class="color-control">
          <span
            class="color-swatch"
            data-testid="style-border-color-swatch"
            role="img"
            :aria-label="colorPreviewLabel('Border color', selectedWidget?.style.borderColor, 'transparent')"
            :title="colorPreviewLabel('Border color', selectedWidget?.style.borderColor, 'transparent')"
            :style="{ backgroundColor: selectedWidget?.style.borderColor || 'transparent' }"
          />
          <input data-testid="style-border-color-input" aria-label="Border color" title="Border color" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.borderColor ?? ''" @input="emitStyleText('borderColor', $event)" />
        </span>
      </label>
      <label>Opacity<input data-testid="style-opacity-input" type="number" aria-label="Opacity" title="Opacity" min="0" max="100" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.opacity ?? 100" :aria-invalid="inspectorErrors.opacity ? 'true' : undefined" :aria-describedby="inspectorErrors.opacity ? 'style-opacity-error' : undefined" @input="emitStyleNumber('opacity', $event)" /></label>
      <p v-if="inspectorErrors.opacity" id="style-opacity-error" class="field-error" data-testid="style-opacity-error" role="alert">{{ inspectorErrors.opacity }}</p>
      <label>Radius<input data-testid="style-radius-input" type="number" aria-label="Radius" title="Radius" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.radius ?? 0" :aria-invalid="inspectorErrors.radius ? 'true' : undefined" :aria-describedby="inspectorErrors.radius ? 'style-radius-error' : undefined" @input="emitStyleNumber('radius', $event)" /></label>
      <p v-if="inspectorErrors.radius" id="style-radius-error" class="field-error" data-testid="style-radius-error" role="alert">{{ inspectorErrors.radius }}</p>
      <label>Padding Top<input data-testid="style-padding-top-input" type="number" aria-label="Padding top" title="Padding top" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.padding?.top ?? 0" :aria-invalid="inspectorErrors['padding-top'] ? 'true' : undefined" :aria-describedby="inspectorErrors['padding-top'] ? 'style-padding-top-error' : undefined" @input="emitPaddingSide('top', $event)" /></label>
      <p v-if="inspectorErrors['padding-top']" id="style-padding-top-error" class="field-error" data-testid="style-padding-top-error" role="alert">{{ inspectorErrors['padding-top'] }}</p>
      <label>Padding Right<input data-testid="style-padding-right-input" type="number" aria-label="Padding right" title="Padding right" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.padding?.right ?? 0" :aria-invalid="inspectorErrors['padding-right'] ? 'true' : undefined" :aria-describedby="inspectorErrors['padding-right'] ? 'style-padding-right-error' : undefined" @input="emitPaddingSide('right', $event)" /></label>
      <p v-if="inspectorErrors['padding-right']" id="style-padding-right-error" class="field-error" data-testid="style-padding-right-error" role="alert">{{ inspectorErrors['padding-right'] }}</p>
      <label>Padding Bottom<input data-testid="style-padding-bottom-input" type="number" aria-label="Padding bottom" title="Padding bottom" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.padding?.bottom ?? 0" :aria-invalid="inspectorErrors['padding-bottom'] ? 'true' : undefined" :aria-describedby="inspectorErrors['padding-bottom'] ? 'style-padding-bottom-error' : undefined" @input="emitPaddingSide('bottom', $event)" /></label>
      <p v-if="inspectorErrors['padding-bottom']" id="style-padding-bottom-error" class="field-error" data-testid="style-padding-bottom-error" role="alert">{{ inspectorErrors['padding-bottom'] }}</p>
      <label>Padding Left<input data-testid="style-padding-left-input" type="number" aria-label="Padding left" title="Padding left" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.padding?.left ?? 0" :aria-invalid="inspectorErrors['padding-left'] ? 'true' : undefined" :aria-describedby="inspectorErrors['padding-left'] ? 'style-padding-left-error' : undefined" @input="emitPaddingSide('left', $event)" /></label>
      <p v-if="inspectorErrors['padding-left']" id="style-padding-left-error" class="field-error" data-testid="style-padding-left-error" role="alert">{{ inspectorErrors['padding-left'] }}</p>
      <label v-if="canEditText">Letter Space<input data-testid="style-letter-space-input" type="number" aria-label="Letter spacing" title="Letter spacing" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.letterSpace ?? 0" @input="emitStyleNumber('letterSpace', $event)" /></label>
      <label v-if="canEditText">Line Space<input data-testid="style-line-space-input" type="number" aria-label="Line spacing" title="Line spacing" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.lineSpace ?? 0" @input="emitStyleNumber('lineSpace', $event)" /></label>
    </section>
    <section v-if="activeInspectorTab === 'layout' && selectedWidget" class="inspector-section">
      <h2>Target</h2>
      <div class="target-summary-card" data-testid="target-summary-card">
        <strong>{{ project.target.deviceName }}</strong>
        <span>{{ project.target.width }} x {{ project.target.height }} · {{ project.target.dpi }} DPI · {{ project.target.colorDepth }}-bit</span>
      </div>
      <label>Device<input data-testid="target-device-name-input" aria-label="Target device name" title="Target device name" :value="project.target.deviceName" :aria-invalid="inspectorErrors['target-device-name'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-device-name'] ? 'target-device-name-error' : undefined" @input="emitInput('update-target-device-name', $event)" /></label>
      <p v-if="inspectorErrors['target-device-name']" id="target-device-name-error" class="field-error" data-testid="target-device-name-error" role="alert">{{ inspectorErrors['target-device-name'] }}</p>
      <label>
        LVGL
        <select data-testid="target-lvgl-version-select" aria-label="Target LVGL version" title="Target LVGL version" :value="project.target.lvglVersion" @change="emitInput('update-target-lvgl-version', $event)">
          <option value="8.3">8.3</option>
        </select>
      </label>
      <label>Width<input data-testid="target-width-input" type="number" aria-label="Target width" title="Target width" min="1" step="1" :value="project.target.width" :aria-invalid="inspectorErrors['target-width'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-width'] ? 'target-width-error' : undefined" @input="emitTargetNumber('width', $event)" /></label>
      <p v-if="inspectorErrors['target-width']" id="target-width-error" class="field-error" data-testid="target-width-error" role="alert">{{ inspectorErrors['target-width'] }}</p>
      <label>Height<input data-testid="target-height-input" type="number" aria-label="Target height" title="Target height" min="1" step="1" :value="project.target.height" :aria-invalid="inspectorErrors['target-height'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-height'] ? 'target-height-error' : undefined" @input="emitTargetNumber('height', $event)" /></label>
      <p v-if="inspectorErrors['target-height']" id="target-height-error" class="field-error" data-testid="target-height-error" role="alert">{{ inspectorErrors['target-height'] }}</p>
      <label>DPI<input data-testid="target-dpi-input" type="number" aria-label="Target DPI" title="Target DPI" min="1" step="1" :value="project.target.dpi" :aria-invalid="inspectorErrors['target-dpi'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-dpi'] ? 'target-dpi-error' : undefined" @input="emitTargetNumber('dpi', $event)" /></label>
      <p v-if="inspectorErrors['target-dpi']" id="target-dpi-error" class="field-error" data-testid="target-dpi-error" role="alert">{{ inspectorErrors['target-dpi'] }}</p>
      <label>
        Color Depth
        <select data-testid="target-color-depth-select" aria-label="Target color depth" title="Target color depth" :value="project.target.colorDepth" @change="emitInput('update-target-color-depth', $event)">
          <option value="16">16</option>
          <option value="32">32</option>
        </select>
      </label>
    </section>
    <section v-if="activeInspectorTab === 'layout' && selectedWidget" class="inspector-section">
      <h2>Layout</h2>
      <label>X<input data-testid="layout-x-input" type="number" aria-label="Layout X" title="Layout X" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.x" @input="emitLayoutNumber('x', $event)" /></label>
      <label>Y<input data-testid="layout-y-input" type="number" aria-label="Layout Y" title="Layout Y" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.y" @input="emitLayoutNumber('y', $event)" /></label>
      <label>Width<input data-testid="layout-width-input" type="number" aria-label="Layout width" title="Layout width" min="1" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.width" :aria-invalid="inspectorErrors.width ? 'true' : undefined" :aria-describedby="inspectorErrors.width ? 'layout-width-error' : undefined" @input="emitLayoutNumber('width', $event)" /></label>
      <p v-if="inspectorErrors.width" id="layout-width-error" class="field-error" data-testid="layout-width-error" role="alert">{{ inspectorErrors.width }}</p>
      <label>Height<input data-testid="layout-height-input" type="number" aria-label="Layout height" title="Layout height" min="1" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.height" :aria-invalid="inspectorErrors.height ? 'true' : undefined" :aria-describedby="inspectorErrors.height ? 'layout-height-error' : undefined" @input="emitLayoutNumber('height', $event)" /></label>
      <p v-if="inspectorErrors.height" id="layout-height-error" class="field-error" data-testid="layout-height-error" role="alert">{{ inspectorErrors.height }}</p>
      <label>
        Align
        <select data-testid="layout-align-select" aria-label="Layout alignment" title="Layout alignment" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.align ?? 'top-left'" @change="emitInput('update-layout-align', $event)">
          <option value="top-left">top-left</option>
          <option value="top-right">top-right</option>
          <option value="center">center</option>
          <option value="bottom-left">bottom-left</option>
          <option value="bottom-right">bottom-right</option>
        </select>
      </label>
      <label v-if="canEditFlex">
        Flex Direction
        <select data-testid="layout-flex-direction-select" aria-label="Flex direction" title="Flex direction" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.flex?.direction ?? 'row'" @change="emitInput('update-flex-direction', $event)">
          <option value="row">row</option>
          <option value="column">column</option>
        </select>
      </label>
      <label v-if="canEditFlex">Gap<input data-testid="layout-gap-input" type="number" aria-label="Flex gap" title="Flex gap" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.flex?.gap ?? 0" :aria-invalid="inspectorErrors.gap ? 'true' : undefined" :aria-describedby="inspectorErrors.gap ? 'layout-gap-error' : undefined" @input="emitInput('update-flex-gap', $event)" /></label>
      <p v-if="inspectorErrors.gap" id="layout-gap-error" class="field-error" data-testid="layout-gap-error" role="alert">{{ inspectorErrors.gap }}</p>
      <label v-if="canEditFlex"><input data-testid="layout-flex-wrap-input" type="checkbox" aria-label="Flex wrap" title="Flex wrap" :disabled="selectedWidget?.locked" :checked="selectedWidget?.layout.flex?.wrap === true" @change="emit('update-flex-wrap', ($event.target as HTMLInputElement).checked)" /> Wrap</label>
    </section>
    <section v-if="activeInspectorTab === 'events' && selectedWidget" class="inspector-section">
      <h2>Events</h2>
      <label>
        Event
        <select data-testid="event-type-select" aria-label="Event type" title="Event type" :disabled="eventFieldsDisabled" :value="eventType" @change="updateEventType">
          <option value="LV_EVENT_CLICKED">LV_EVENT_CLICKED</option>
          <option value="LV_EVENT_VALUE_CHANGED">LV_EVENT_VALUE_CHANGED</option>
          <option value="LV_EVENT_READY">LV_EVENT_READY</option>
          <option value="LV_EVENT_CANCEL">LV_EVENT_CANCEL</option>
        </select>
      </label>
      <label>
        Target
        <select data-testid="event-target-select" aria-label="Event target" title="Event target" :value="eventTargetWidgetId" @change="emitInput('update:event-target-widget-id', $event)">
          <option v-for="row in eventTargetRows" :key="row.widget.id" :value="row.widget.id">
            {{ row.widget.name }}
          </option>
        </select>
      </label>
      <label>
        Handler
        <input data-testid="event-handler-input" aria-label="Event handler" title="Event handler" :disabled="eventFieldsDisabled" :value="eventHandler" @input="emitInput('update:event-handler', $event)" @keydown.enter.prevent="submitEvent" />
      </label>
      <button class="select-like" type="button" data-testid="add-event-button" :disabled="addEventDisabled" :aria-label="addEventLabel" :title="addEventLabel" @click="submitEvent">Add Event</button>
      <p v-if="selectedEvents.length === 0" class="event-empty" data-testid="event-empty-state" role="status" aria-live="polite" aria-atomic="true">
        No events bound to this selection.
      </p>
      <div v-else class="event-list-header" data-testid="event-list-header">
        <span>Target</span>
        <span>Event</span>
        <span>Handler</span>
        <span>Action</span>
      </div>
      <ul v-if="selectedEvents.length > 0" class="event-list" data-testid="event-list">
        <li v-for="event in selectedEvents" :key="event.id">
          <strong data-event-cell="target">{{ eventWidgetName(event.widgetId) }}</strong>
          <span data-event-cell="event">{{ event.event }}</span>
          <span data-event-cell="handler">{{ event.handlerName }}</span>
          <button
            class="mini-action"
            type="button"
            data-event-cell="action"
            :aria-label="eventRemoveLabel(event)"
            :title="eventRemoveLabel(event)"
            :data-testid="`remove-event-${event.id}`"
            :disabled="eventWidgetLocked(event.widgetId)"
            @click="emit('remove-event', event.id)"
          >
            <IconGlyph name="close" />
          </button>
        </li>
      </ul>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { AssetRef, EventBinding, ProjectDoc, WidgetNode } from "@hiveton-lvgl/schema";
import IconGlyph from "./IconGlyph.vue";
import type { LayerRow } from "./LayersPanel.vue";

export type InspectorTab = "style" | "events" | "layout";

const props = defineProps<{
  activeInspectorTab: InspectorTab;
  eventHandler: string;
  eventTargetWidgetId: string;
  eventType: EventBinding["event"];
  fontAssets: AssetRef[];
  imageAssets: AssetRef[];
  inspectorErrors: Record<string, string>;
  eventTargetRows: LayerRow[];
  layerRows: LayerRow[];
  project: ProjectDoc;
  selectedEvents: EventBinding[];
  selectedWidget: WidgetNode | null;
}>();

const emit = defineEmits<{
  "add-event": [];
  "bind-image-asset": [assetId: string];
  "remove-event": [eventId: string];
  "rename-widget": [name: string];
  "update:event-handler": [handler: string];
  "update:event-target-widget-id": [widgetId: string];
  "update:event-type": [eventType: EventBinding["event"]];
  "update:active-inspector-tab": [tab: InspectorTab];
  "update-flex-direction": [direction: string];
  "update-flex-gap": [gap: string];
  "update-flex-wrap": [wrap: boolean];
  "update-layout-align": [align: string];
  "update-layout-number": [field: "x" | "y" | "width" | "height", value: string];
  "update-padding-side": [side: "top" | "right" | "bottom" | "left", value: string];
  "update-prop-checked": [checked: boolean];
  "update-prop-number": [field: string, value: string];
  "update-prop-text": [field: string, value: string];
  "update-prop-values": [value: string];
  "update-style-align": [align: string];
  "update-style-font": [font: string];
  "update-style-number": [field: "opacity" | "radius" | "letterSpace" | "lineSpace", value: string];
  "update-style-text": [field: "textColor" | "bgColor" | "borderColor", value: string];
  "update-target-color-depth": [value: string];
  "update-target-device-name": [value: string];
  "update-target-lvgl-version": [value: string];
  "update-target-number": [field: "width" | "height" | "dpi", value: string];
  "update-text": [text: string];
}>();

const selectedText = computed(() => String(props.selectedWidget?.props.text ?? ""));
const canEditText = computed(() =>
  props.selectedWidget?.type === "label"
  || props.selectedWidget?.type === "button"
  || props.selectedWidget?.type === "checkbox"
  || props.selectedWidget?.type === "dropdown"
);
const hasRangeProps = computed(() =>
  props.selectedWidget?.type === "slider" || props.selectedWidget?.type === "bar" || props.selectedWidget?.type === "arc"
);
const canEditFlex = computed(() => props.selectedWidget?.type === "container" || props.selectedWidget?.type === "screen");
const inspectorTabs: InspectorTab[] = ["style", "events", "layout"];
const styleTabRef = ref<HTMLButtonElement | null>(null);
const eventsTabRef = ref<HTMLButtonElement | null>(null);
const layoutTabRef = ref<HTMLButtonElement | null>(null);
const inspectorTabRefs = [styleTabRef, eventsTabRef, layoutTabRef];

function handleInspectorTabKeydown(event: KeyboardEvent, tab: InspectorTab): void {
  const currentIndex = inspectorTabs.indexOf(tab);
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? inspectorTabs.length - 1
      : event.key === "ArrowRight"
        ? (currentIndex + 1) % inspectorTabs.length
        : event.key === "ArrowLeft"
          ? (currentIndex - 1 + inspectorTabs.length) % inspectorTabs.length
          : -1;
  if (nextIndex < 0) {
    return;
  }
  event.preventDefault();
  emit("update:active-inspector-tab", inspectorTabs[nextIndex]);
  inspectorTabRefs[nextIndex].value?.focus();
}

const imageBindingState = computed(() => {
  const assetId = props.selectedWidget?.props.assetId;
  if (typeof assetId !== "string" || !assetId) {
    if (props.imageAssets.length === 0) {
      return { tone: "warning", message: "No image assets imported. Use the Assets panel + button to import one." };
    }
    return { tone: "warning", message: "No image asset selected." };
  }
  const asset = props.imageAssets.find((item) => item.id === assetId);
  if (!asset) {
    return { tone: "warning", message: "Selected image asset is missing from this project." };
  }
  return { tone: "success", message: `Bound to ${asset.name}` };
});
const eventTargetWidget = computed(() =>
  props.eventTargetRows.find((row) => row.widget.id === props.eventTargetWidgetId)?.widget ?? null
);
const eventFieldsDisabled = computed(() => eventTargetWidget.value?.locked === true);
const addEventDisabled = computed(() => eventFieldsDisabled.value || props.eventHandler.trim().length === 0);
const addEventLabel = computed(() => {
  const targetName = eventTargetWidget.value?.name ?? "selected widget";
  if (eventFieldsDisabled.value) {
    return `Unlock ${targetName} to add events`;
  }
  const eventName = props.eventType;
  if (props.eventHandler.trim().length === 0) {
    return `Enter handler to add ${eventName} event to ${targetName}`;
  }
  return `Add ${eventName} event to ${targetName}`;
});

function eventWidgetLocked(widgetId: string): boolean {
  return props.eventTargetRows.find((row) => row.widget.id === widgetId)?.widget.locked === true;
}

function eventWidgetName(widgetId: string): string {
  return props.eventTargetRows.find((row) => row.widget.id === widgetId)?.widget.name ?? widgetId;
}

function submitEvent(): void {
  if (!addEventDisabled.value) {
    emit("add-event");
  }
}

function propString(field: string): string {
  const value = props.selectedWidget?.props[field];
  return typeof value === "string" ? value : "";
}

function propNumber(field: string, fallback: number): number {
  const value = props.selectedWidget?.props[field];
  return typeof value === "number" ? value : fallback;
}

function propValues(): string {
  const value = props.selectedWidget?.props.values;
  return Array.isArray(value) ? value.join(", ") : "";
}

function colorPreviewLabel(label: string, value: string | undefined, fallback: string): string {
  return `${label} preview ${value && value.length > 0 ? value : fallback}`;
}

function eventRemoveLabel(event: EventBinding): string {
  return `Remove ${event.event} event from ${eventWidgetName(event.widgetId)} handled by ${event.handlerName}`;
}

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
}

type StringInputEvent =
  | "bind-image-asset"
  | "rename-widget"
  | "update:event-handler"
  | "update:event-target-widget-id"
  | "update-flex-direction"
  | "update-flex-gap"
  | "update-layout-align"
  | "update-style-align"
  | "update-style-font"
  | "update-target-color-depth"
  | "update-target-device-name"
  | "update-target-lvgl-version"
  | "update-text";

function emitInput(eventName: StringInputEvent, event: Event): void {
  const value = inputValue(event);
  switch (eventName) {
    case "bind-image-asset":
      emit("bind-image-asset", value);
      break;
    case "rename-widget":
      emit("rename-widget", value);
      break;
    case "update:event-handler":
      emit("update:event-handler", value);
      break;
    case "update:event-target-widget-id":
      emit("update:event-target-widget-id", value);
      break;
    case "update-flex-direction":
      emit("update-flex-direction", value);
      break;
    case "update-flex-gap":
      emit("update-flex-gap", value);
      break;
    case "update-layout-align":
      emit("update-layout-align", value);
      break;
    case "update-style-align":
      emit("update-style-align", value);
      break;
    case "update-style-font":
      emit("update-style-font", value);
      break;
    case "update-target-color-depth":
      emit("update-target-color-depth", value);
      break;
    case "update-target-device-name":
      emit("update-target-device-name", value);
      break;
    case "update-target-lvgl-version":
      emit("update-target-lvgl-version", value);
      break;
    case "update-text":
      emit("update-text", value);
      break;
  }
}

function emitFieldInput(eventName: "update-prop-number" | "update-prop-text", field: string, event: Event): void {
  if (eventName === "update-prop-number") {
    emit("update-prop-number", field, inputValue(event));
    return;
  }
  emit("update-prop-text", field, inputValue(event));
}

function emitStyleText(field: "textColor" | "bgColor" | "borderColor", event: Event): void {
  emit("update-style-text", field, inputValue(event));
}

function emitStyleNumber(field: "opacity" | "radius" | "letterSpace" | "lineSpace", event: Event): void {
  emit("update-style-number", field, inputValue(event));
}

function emitPaddingSide(side: "top" | "right" | "bottom" | "left", event: Event): void {
  emit("update-padding-side", side, inputValue(event));
}

function emitLayoutNumber(field: "x" | "y" | "width" | "height", event: Event): void {
  emit("update-layout-number", field, inputValue(event));
}

function emitTargetNumber(field: "width" | "height" | "dpi", event: Event): void {
  emit("update-target-number", field, inputValue(event));
}

function updateEventType(event: Event): void {
  const value = inputValue(event);
  if (value === "LV_EVENT_CLICKED" || value === "LV_EVENT_VALUE_CHANGED" || value === "LV_EVENT_READY" || value === "LV_EVENT_CANCEL") {
    emit("update:event-type", value);
  }
}
</script>
