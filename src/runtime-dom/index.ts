import { createRenderer } from "../runtime-core/index"
import { nodeOps } from "./nodeOps"
import { patchProp } from "./patchProp";

export function createApp(rootComponent) {
    // 根据组件， 创建一个渲染器
    const app = ensureRenderer().createApp(rootComponent);

    const { mount } = app
    app.mount = function (container) {
        container = document.querySelector(container)
        // 挂载时需要先把容器清空在挂载
        container.innderHTML = ''

        mount(container)
    }

    return app
}


const renderOptions = {...nodeOps, patchProp}

function ensureRenderer() {
    return createRenderer(renderOptions)
}