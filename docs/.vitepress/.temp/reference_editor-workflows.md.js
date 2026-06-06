import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Editor Workflows","description":"","frontmatter":{},"headers":[],"relativePath":"reference/editor-workflows.md","filePath":"reference/editor-workflows.md"}');
const _sfc_main = { name: "reference/editor-workflows.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="editor-workflows" tabindex="-1">Editor Workflows <a class="header-anchor" href="#editor-workflows" aria-label="Permalink to “Editor Workflows”">​</a></h1><p>This is the placeholder reference page for the editor workflow inventory.</p><p>The generated version of this page will be added in a later phase and will use <code>.plans/editor-workflows-inventory.md</code> as its source.</p><h2 id="current-source" tabindex="-1">Current Source <a class="header-anchor" href="#current-source" aria-label="Permalink to “Current Source”">​</a></h2><ul><li><code>.plans/editor-workflows-inventory.md</code></li></ul><h2 id="planned-sections" tabindex="-1">Planned Sections <a class="header-anchor" href="#planned-sections" aria-label="Permalink to “Planned Sections”">​</a></h2><ul><li>Atomic workflows</li><li>Composite workflows</li><li>Repetitive or redundant workflows</li><li>Missing or incomplete workflows</li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("reference/editor-workflows.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const editorWorkflows = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  editorWorkflows as default
};
