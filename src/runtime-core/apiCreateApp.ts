import { createVnode } from "./vnode"

export function createAppApi(render) {
    return (rootComponent) => {
        const app = {
            // 跟平台无关
            mount(container) {
                // 用户调用的mount方法分
                const vnode = createVnode(rootComponent)
                render(vnode, container)
            }
        }

        return app
    }
}