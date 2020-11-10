import { isFunction } from "../shared/index";

export function createComponentInstance(vnode) {
    const instance = {
        type: vnode.type,
        props: {},
        vnode,
        isMounted: false, // 默认组件没有挂载
    }


    return instance
}

export function setupComponent (instance) {
    // 1. 初始化属性

    // 2. 插槽初始化

    // 3. 调用setup方法
    setupStatefulComponent(instance);
}

function setupStatefulComponent(instance) {
    const Component = instance.type; // 组件的虚拟节点

    const { setup } = Component;

    if(setup) {
        const setupResult = setup();

        // 返回的是状态活着渲染函数
        handleSetupResult(instance, setupResult)

    }

}


function handleSetupResult(instance, setupResult) {
    if(isFunction(setupResult)) {
        instance.render = setupResult;
    }else {
        instance.setupState = setupResult;
    }

    finishComponentSetup(instance)
}

function finishComponentSetup(instance) {
    const Component = instance.type;

    if(Component.render) {
        // 默认render的优先级高于setup返回的render
        instance.render = Component.render
    }else if(!instance.render){
        // 编译模版
        // compile(Component.template)
    }
}