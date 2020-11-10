import { effect } from "../reactivity/index"
// import { effect } from "../../node_modules/_@vue_reactivity@3.0.2@@vue/reactivity/dist/reactivity"
import { ShapeFlags } from "../shared/index"
import { createAppApi } from "./apiCreateApp"
import { createComponentInstance, setupComponent } from "./component"

// 不同凭爱可以实现不同的逻辑操作
export function createRenderer(options) {
    return baseCreateRenderer(options)
    
}

function baseCreateRenderer(options) {
    const { 
        createElement: hostCreateElement, 
        patchProp: hostPatchProp,
        setElementText: hostSetElementText,
        remove: hostRemove,
        insert: hostInsert,
    } = options
    // 把虚拟节点变为真实节点， 挂载到容器上
    const render = (vnode, container) => {
        patch(null, vnode, container)
    }

    const mountElement = (vnode, container, anchor?) => {
        
        console.log('mountComponent', vnode)
        let { shapeFlag } = vnode 
        let el = vnode.el = hostCreateElement(vnode.type)
        // let { type } = vnode;
        hostInsert(el, container, anchor)

        // 创建儿子节点

        if(shapeFlag & ShapeFlags.TEXT_CHILDREN) {
            hostSetElementText(el, vnode.children)
        }else if(shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            mounteChildren(vnode.children, el)
        }

        if(vnode.props) {
            for(let key in vnode.props){
                hostPatchProp(el, key, null, vnode.props[key])
            }
        }
    }

    const patchProps = (oldProps, newProps, el) => {
        if(oldProps !== newProps) {
            // 新属性覆盖掉旧的属性
            for(let key in newProps) {
                const prev = oldProps[key];
                const next = newProps[key];
                if(prev !== next) {
                    hostPatchProp(el, key, prev, next);
                }
            }

            for(let key in oldProps) {
                if(!(key in newProps)) {
                    hostPatchProp(el, key, oldProps[key], null)
                } 
            }

            // 老得有属性 新的有没有，删除掉老的属性
        }
    }   
    

    // 比较孩子
    const patchChild = (oldVnode, vnode, el) => {
        const oldChild = oldVnode.children;
        const newChild = vnode.children; // 获取新的所有的children节点
        const prevShapeFlag = oldVnode.shapeFlag;
        const shapeFlag = vnode.shapeFlag

        // 老得是文本 新的也是文本 => 直接覆盖
        // 老得是数组 新的是文本 => 覆盖掉老得
        if(shapeFlag & ShapeFlags.TEXT_CHILDREN) {
            if(oldChild !== newChild) {
                hostSetElementText(el, newChild)
            }
        }
        // 说明新的是数组
        else {
            // 老得是数组， 新的也是数组
            if(prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                console.log('diff算法----')
                patchKeyChildren(oldChild, newChild, el)
            }
            // 如果老的是文本， 新的是数组
            else {
                // 
                if(prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
                    hostSetElementText(el, '')
                }

                if(shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                    for(let i=0; i < newChild.length; i++) {
                        patch(null, newChild[i], el)
                    }
                }
            }


        }

        
        // 老得是文本 新的是数组 => 移除掉老得文本， 生成新的节点塞进去
        // 老得是数组 新的是数组 => diff算法
    }

    // diff算法
    const patchKeyChildren = (oldChildren, newChildren, el) => {
        // 内部优化策略
        let i = 0;
        let e1 = oldChildren.length - 1;
        let e2 = newChildren.length - 1;

        // abc => abde 从头比
        while(i <= e1 && i <= e2) {
            let oldChild = oldChildren[i]
            let newChild = newChildren[i]
            if(isSameVnodeType(oldChild, newChild)) {
                patch(oldChild, newChild, el)
            }else {
                break
            }

            i++
        }

        // abc => dabd 从后比
        while(i <= e1 && i <= e2) {
            let oldChild = oldChildren[e1]
            let newChild = newChildren[e2]

            if(isSameVnodeType(oldChild, newChild)) {
                patch(oldChild, newChild, el)
            }else {
                break
            }
            e1--;
            e2--
        }


        // 只考虑元素新增和删除的情况
        // 尾部添加 adc => adcd （i=3 e1=2 e2=3）

        // 头部添加 adb => dabc (i=0 e1=-1 e2=0)
        // 只要i大于了e1表示新增属性
        if(i > e1) {
            // 表示有新增的部分
            if(i <= e2) {
                
                // 根据e2取它的下一个元素和数组长度进行比较
                const nextPos = e2 + 1
                // console.log(i, e1, e2)

                // 往前添加 否 往后添加
                const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null
                while(i <= e2) {
                    patch(null, newChildren[i], el, anchor);
                    i++
                }
            }
        }

        // 删除元素, 老得比新的长 abcd => adc (i=3 e1=3 e2=2)
        else if(i > e2) {
            console.log(i, e1, e2) 
            // (i=2 e1=1, e2=0)
            while(i <= e1) {
                hostRemove(oldChildren[i].el)
                i++
            }
        }

        // 无规律的情况
        else {
            // ab[cde]fg => ab[edch]fg (i=2 e1=4 e2=5)
            // ab[cde]fg i=2 => e1=4 之间需要diff
            // ab[edch]fg i=2 => e1=5 之间需要diff
            const start1 = i;
            const start2 = i;

            // 新的索引和key做成一个映射表
            const keyToNewIndexMap = new Map();

            for(let i=start2; i<=e2; i++) {
                const nextChild = newChildren[i];
                keyToNewIndexMap.set(nextChild.key, i)
            }

            const toBePatched = e2 - start2 + 1;
            const newIndexToOldMapIndex = new Array(toBePatched).fill(0)
            // console.log(keyToNewIndexMap)

            for(let i = start1; i <= e1; i++) {
                const prevChild = oldChildren[i];
                // 看老得孩子中有没有新孩子节点的key值， 如果有， 获取新的节点的索引.
                let newIndex = keyToNewIndexMap.get(prevChild.key); 

                if(newIndex == undefined) {
                    // 老得没有， 新的直接删除
                    hostRemove(prevChild.el);
                }else {
                    newIndexToOldMapIndex[newIndex - start2] = i + 1;

                    patch(prevChild, newChildren[newIndex], el)
                }
            }

            // 更改位置
            for(let i=toBePatched-1; i>=0; i--){
                const nextIndex = start2 + i; // [e, d, c, h] // 找到h
                const nextChild = newChildren[nextIndex];
                let anchor = nextIndex + 1 < newChildren.length ? newChildren[nextIndex + 1].el : null

                // 说明这是一个新元素， 直接创建插入到当前元素的下一个
                if(newIndexToOldMapIndex[i] === 0) {
                    patch(null, nextChild, el, anchor)
                }else {
                    // 根据参照物一次将节点直接移动过去
                    hostInsert(nextChild.el, el, anchor)
                }
            }

            console.log(newIndexToOldMapIndex)
        }

        

        console.log(i, e1, e2)
    }

    const patchElement = (oldVnode, vnode, container) => {
        console.log(oldVnode, vnode)
        // 现比较属性， 在比较孩子
        let el = (vnode.el = oldVnode.el);

        // 更新属性
        const oldProps = oldVnode.props || {};
        const newProps = vnode.props || {};

        // 比对属性
        patchProps(oldProps, newProps, el)

        patchChild(oldVnode, vnode, el);

    }

    const mounteChildren = (children, container) => {
        for(let i=0; i<children.length; i++) {
            patch(null, children[i], container)
        }
    }

    const mountComponent = (initialVnode, container) => {
        // 组件挂载逻辑
        /**
         * 1. 创建组件的实例， 组件实例要记录当前组件的状态
         * 2. 找到组件的render方法
         * 3. 执行render方法
         */
        initialVnode.component = createComponentInstance(initialVnode);

        // 初始化组件， 调用组件的setup方法
        setupComponent(initialVnode.component)
        console.log(initialVnode.component.render)
        // 调用render方法， 并且数据变化了， 会重新渲染
        setupRenderEffect(initialVnode.component, initialVnode, container); // 给组件创建一个effect, 等驾驭vue2中的watcher
    }

    const setupRenderEffect = (instance, initialVnode, container) => {
        effect(function componentEffect() {
            if(!instance.isMounted) {
                // 渲染组件中的内容
                const subTree = instance.subTree = instance.render(); // 组件对应的渲染结果
                patch(null, subTree, container) 
                instance.isMounted = true
            }else {
                // 更新逻辑
                let prev = instance.subTree // 上一次的渲染结果
                let next = instance.render();

                patch(prev, next, container)

            }
        })
    }

    const updateComponent = (oldVnode, vnode, container) => {
       
    }

    const processElement = (oldVnode, vnode, container, anchor?) => {
        if(!oldVnode) {
            mountElement(vnode, container, anchor)
        }else {
            // 比较两个虚拟节点
            patchElement(oldVnode, vnode, container)
        }
    }

    const processComponent = (oldVnode, vnode, container) => {
        // console.log(oldVnode, vnode)
        if(oldVnode == null) {
            mountComponent(vnode, container)
        }else {
            updateComponent(oldVnode, vnode, container)
        }
    } 

    const isSameVnodeType = (oldVnode, vnode) => {
        return oldVnode.type === vnode.type && oldVnode.key === vnode.key
    }
    const patch = (oldVnode, vnode, container, anchor?) => {
        let { shapeFlag } = vnode

        // 如果不是第一次渲染， 并且标签不同， 直接移除掉
        if(oldVnode && !isSameVnodeType(oldVnode, vnode)) {
            // 删除老节点
            hostRemove(oldVnode.el);
            oldVnode = null
        }
        
        if(shapeFlag & ShapeFlags.ELEMENT) {
            processElement(oldVnode, vnode, container, anchor)
        }else if(shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
            // 比较两个虚拟节点
            processComponent(oldVnode, vnode, container)
        } 
    }



    return  {
        createApp: createAppApi(render)
    }
}