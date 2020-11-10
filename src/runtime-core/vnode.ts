import { isArray, isObject, isString, ShapeFlags } from "../shared/index"


export function createVnode(type, props: any={}, children=null) {
    const shapeFlag = isString(type)   
        ? 
        ShapeFlags.ELEMENT 
        : 
        isObject(type) 
            ? 
            ShapeFlags.STATEFUL_COMPONENT 
            : 
            0




    // 虚拟节点可以表示dom结构， 也可以用来表示组件
    const vnode = {
        type, 
        props,
        children,
        component: null, // 组件实例
        el: null,// 虚拟节点和真实节点要做一个映射关系
        key: props.key,
        shapeFlag, // 虚拟节点的类型， 元素/组件 
    }

    if(isArray(children)) {
        vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
    }else {
        vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN
    }

    return vnode
}