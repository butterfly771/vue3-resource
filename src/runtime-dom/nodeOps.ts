export const nodeOps = {
    createElement(type) {
        return document.createElement(type)
    },
    setElementText(el, text) {
        return el.textContent = text;
    },
    insert(child, parent: HTMLElement, anchor=null) {
        parent.insertBefore(child, anchor)
    },
    remove(child) {
        const parent = child.parentNode;
        if(parent) {
            parent.removeChild(child)
        }
    }
}