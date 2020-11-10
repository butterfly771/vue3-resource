(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Vue = {}));
}(this, (function (exports) { 'use strict';

    function computed() {
    }

    var isObject = function (val) { return typeof val === 'object' && val !== null; };
    var isSymbol = function (val) { return typeof val === 'symbol'; };
    var isArray = function (val) { return Array.isArray(val); };
    var isInteger = function (key) { return '' + parseInt(key, 10) === key; };
    var hasOwn = function (val, key) { return hasOwnProperty.call(val, key); };
    var hasChanged = function (val, oldValue) { return val !== oldValue; };
    var isString = function (val) { return typeof val === 'string'; };
    var isFunction = function (val) { return typeof val === 'function'; };
    var hasOwnProperty = Object.prototype.hasOwnProperty;

    function effect(fn, options) {
        if (options === void 0) { options = {}; }
        var effect = createReactiveEffect(fn, options);
        if (!options.lazy) {
            effect();
        }
        return effect;
    }
    window['activeEffect'] = window['activeEffect'] ? window['activeEffect'] : undefined; // 用来存储当前的effect函数
    var uid = 0;
    var effectStack = [];
    function createReactiveEffect(fn, options) {
        var effect = function () {
            // 防止重复更新， 防止递归执行
            if (!effectStack.includes(effect)) {
                try {
                    window['activeEffect'] = effect;
                    effectStack.push(window['activeEffect']);
                    // console.log('activeEffect', window['activeEffect'])
                    return fn(); // 用户自己写的逻辑, 内部会对数据进行取值操作， 在取值的时候， 可以拿到这个activeEffect
                }
                finally {
                    effectStack.pop();
                    window['activeEffect'] = effectStack[effectStack.length - 1];
                }
            }
        };
        effect.id = uid++;
        effect.deps = []; // 用来表示effect中依赖了那些属性
        effect.options = options;
        return effect;
    }
    var targetMap = new WeakMap();
    // 将属性和effec作一个关联
    function track(target, key, effect) {
        // console.log('activeEffect', window['activeEffect'])
        if (window['activeEffect'] === undefined) {
            return;
        }
        // {}
        var depsMap = targetMap.get(target);
        if (!depsMap) {
            // { object: {} }
            targetMap.set(target, (depsMap = new Map()));
        }
        // { object: {a: [effect]} }
        var dep = depsMap.get(key);
        if (!dep) {
            depsMap.set(key, (dep = new Set()));
        }
        if (!dep.has(window['activeEffect'])) { // 如果没有effect， 就把effect放入到集合中
            dep.add(window['activeEffect']);
            window['activeEffect'].deps.push(dep);
        }
        // console.log(targetMap )
    }
    // 触发更新
    function trigger(target, type, key, value, oldValue) {
        // 判断这个目标有没有收集到依赖
        var depsMap = targetMap.get(target);
        if (!depsMap) {
            return;
        }
        var run = function (effects) {
            if (effects)
                effects.forEach(function (effect) { return effect(); });
        };
        // 数组有特殊的情况
        if (key === 'length' && isArray(target)) {
            depsMap.forEach(function (dep, key) {
                // 如果改的长度小于数组原有的长度， 应该更新试图
                if (key === 'length' || key >= value) {
                    run(dep);
                }
            });
        }
        else {
            // 说明修改了key
            if (key !== void 0) {
                // 获取到相应的effect
                run(depsMap.get(key));
            }
            switch (type) {
                case 'add':
                    // 给数组通过索引增加选项
                    if (isArray(target)) {
                        if (isInteger(key)) {
                            // 如果页面中直接使用了数组， 也会对数组进行取值操作， 会对length进行收集， 新增属性是直接
                            // 触发length即可
                            run(depsMap.get('length'));
                        }
                    }
                    break;
            }
        }
    }

    function createGetter() {
        return function get(target, key, receiver) {
            var res = Reflect.get(target, key, receiver);
            // 如果取得是symbol类型， 直接忽略它
            if (isSymbol(res)) {
                return res;
            }
            // 依赖收集
            // console.log('此时进行了数据获取操作')
            track(target, key);
            // 取值的时候才递归
            if (isObject(res)) {
                return reactive(res);
            }
            return res;
        };
    }
    function createSetter() {
        return function set(target, key, value, receiver) {
            // vue2不支持新增属性
            // 那么这个时候怎么知道是新增还是修改呢
            var oldValue = target[key]; // 如果是修改， 那么肯定是有老值的 
            // 第一种是数组新增的逻辑， 第二种是对象的逻辑 
            // 检查一下有没有这个属性
            // 满足条件是数组并且修改了
            var hasKey = isArray(target) && isInteger(key) ? Number(key) < target.length
                :
                    // 如果是对象的话判断有没有属性
                    hasOwn(target, key);
            var result = Reflect.set(target, key, value, receiver);
            if (!hasKey) {
                // console.log('新增属性')
                trigger(target, 'add', key, value);
            }
            else if (hasChanged(value, oldValue)) {
                // console.log('修改属性')
                trigger(target, 'set', key, value);
            }
            return result;
        };
    }
    var get = createGetter(); // 预置参数
    var set = createSetter();
    var mutableHandlers = {
        // 获取对象中的属性会执行此方法
        get: get,
        // 设置对象中的属性会执行此方法
        set: set,
    };

    function reactive(target) {
        // 需要把目标变为响应式对象，Proxy
        return createReactiveObject(target, mutableHandlers);
    }
    var proxyMap = new WeakMap();
    // 核心操作就是读取文件的时候做依赖收集。 数据变化的时候重新执行effect
    function createReactiveObject(target, baseHandlers) {
        // 如果不是对象， 直接返回
        if (!isObject(target)) {
            return target;
        }
        var existingProxy = proxyMap.get(target);
        if (existingProxy) {
            return existingProxy;
        }
        // 只对对外称对象做代理， 默认不会递归， 而且不会重写对象中的属性
        var proxy = new Proxy(target, baseHandlers);
        // 将代理的对象和代理后的结果做一个映射表
        proxyMap.set(target, proxy);
        // 如果是对象， 返回被代理的对象
        return proxy;
    }

    function ref() {
    }

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    function createVnode(type, props, children) {
        if (props === void 0) { props = {}; }
        if (children === void 0) { children = null; }
        var shapeFlag = isString(type)
            ?
                1 /* ELEMENT */
            :
                isObject(type)
                    ?
                        4 /* STATEFUL_COMPONENT */
                    :
                        0;
        // 虚拟节点可以表示dom结构， 也可以用来表示组件
        var vnode = {
            type: type,
            props: props,
            children: children,
            component: null,
            el: null,
            key: props.key,
            shapeFlag: shapeFlag,
        };
        if (isArray(children)) {
            vnode.shapeFlag |= 16 /* ARRAY_CHILDREN */;
        }
        else {
            vnode.shapeFlag |= 8 /* TEXT_CHILDREN */;
        }
        return vnode;
    }

    function createAppApi(render) {
        return function (rootComponent) {
            var app = {
                // 跟平台无关
                mount: function (container) {
                    // 用户调用的mount方法分
                    var vnode = createVnode(rootComponent);
                    render(vnode, container);
                }
            };
            return app;
        };
    }

    function createComponentInstance(vnode) {
        var instance = {
            type: vnode.type,
            props: {},
            vnode: vnode,
            isMounted: false,
        };
        return instance;
    }
    function setupComponent(instance) {
        // 1. 初始化属性
        // 2. 插槽初始化
        // 3. 调用setup方法
        setupStatefulComponent(instance);
    }
    function setupStatefulComponent(instance) {
        var Component = instance.type; // 组件的虚拟节点
        var setup = Component.setup;
        if (setup) {
            var setupResult = setup();
            // 返回的是状态活着渲染函数
            handleSetupResult(instance, setupResult);
        }
    }
    function handleSetupResult(instance, setupResult) {
        if (isFunction(setupResult)) {
            instance.render = setupResult;
        }
        else {
            instance.setupState = setupResult;
        }
        finishComponentSetup(instance);
    }
    function finishComponentSetup(instance) {
        var Component = instance.type;
        if (Component.render) {
            // 默认render的优先级高于setup返回的render
            instance.render = Component.render;
        }
        else if (!instance.render) ;
    }

    // 不同凭爱可以实现不同的逻辑操作
    function createRenderer(options) {
        return baseCreateRenderer(options);
    }
    function baseCreateRenderer(options) {
        var hostCreateElement = options.createElement, hostPatchProp = options.patchProp, hostSetElementText = options.setElementText, hostRemove = options.remove, hostInsert = options.insert;
        // 把虚拟节点变为真实节点， 挂载到容器上
        var render = function (vnode, container) {
            patch(null, vnode, container);
        };
        var mountElement = function (vnode, container, anchor) {
            console.log('mountComponent', vnode);
            var shapeFlag = vnode.shapeFlag;
            var el = vnode.el = hostCreateElement(vnode.type);
            // let { type } = vnode;
            hostInsert(el, container, anchor);
            // 创建儿子节点
            if (shapeFlag & 8 /* TEXT_CHILDREN */) {
                hostSetElementText(el, vnode.children);
            }
            else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                mounteChildren(vnode.children, el);
            }
            if (vnode.props) {
                for (var key in vnode.props) {
                    hostPatchProp(el, key, null, vnode.props[key]);
                }
            }
        };
        var patchProps = function (oldProps, newProps, el) {
            if (oldProps !== newProps) {
                // 新属性覆盖掉旧的属性
                for (var key in newProps) {
                    var prev = oldProps[key];
                    var next = newProps[key];
                    if (prev !== next) {
                        hostPatchProp(el, key, prev, next);
                    }
                }
                for (var key in oldProps) {
                    if (!(key in newProps)) {
                        hostPatchProp(el, key, oldProps[key], null);
                    }
                }
                // 老得有属性 新的有没有，删除掉老的属性
            }
        };
        // 比较孩子
        var patchChild = function (oldVnode, vnode, el) {
            var oldChild = oldVnode.children;
            var newChild = vnode.children; // 获取新的所有的children节点
            var prevShapeFlag = oldVnode.shapeFlag;
            var shapeFlag = vnode.shapeFlag;
            // 老得是文本 新的也是文本 => 直接覆盖
            // 老得是数组 新的是文本 => 覆盖掉老得
            if (shapeFlag & 8 /* TEXT_CHILDREN */) {
                if (oldChild !== newChild) {
                    hostSetElementText(el, newChild);
                }
            }
            // 说明新的是数组
            else {
                // 老得是数组， 新的也是数组
                if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
                    console.log('diff算法----');
                    patchKeyChildren(oldChild, newChild, el);
                }
                // 如果老的是文本， 新的是数组
                else {
                    // 
                    if (prevShapeFlag & 8 /* TEXT_CHILDREN */) {
                        hostSetElementText(el, '');
                    }
                    if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                        for (var i = 0; i < newChild.length; i++) {
                            patch(null, newChild[i], el);
                        }
                    }
                }
            }
            // 老得是文本 新的是数组 => 移除掉老得文本， 生成新的节点塞进去
            // 老得是数组 新的是数组 => diff算法
        };
        // diff算法
        var patchKeyChildren = function (oldChildren, newChildren, el) {
            // 内部优化策略
            var i = 0;
            var e1 = oldChildren.length - 1;
            var e2 = newChildren.length - 1;
            // abc => abde 从头比
            while (i <= e1 && i <= e2) {
                var oldChild = oldChildren[i];
                var newChild = newChildren[i];
                if (isSameVnodeType(oldChild, newChild)) {
                    patch(oldChild, newChild, el);
                }
                else {
                    break;
                }
                i++;
            }
            // abc => dabd 从后比
            while (i <= e1 && i <= e2) {
                var oldChild = oldChildren[e1];
                var newChild = newChildren[e2];
                if (isSameVnodeType(oldChild, newChild)) {
                    patch(oldChild, newChild, el);
                }
                else {
                    break;
                }
                e1--;
                e2--;
            }
            // 只考虑元素新增和删除的情况
            // 尾部添加 adc => adcd （i=3 e1=2 e2=3）
            // 头部添加 adb => dabc (i=0 e1=-1 e2=0)
            // 只要i大于了e1表示新增属性
            if (i > e1) {
                // 表示有新增的部分
                if (i <= e2) {
                    // 根据e2取它的下一个元素和数组长度进行比较
                    var nextPos = e2 + 1;
                    // console.log(i, e1, e2)
                    // 往前添加 否 往后添加
                    var anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null;
                    while (i <= e2) {
                        patch(null, newChildren[i], el, anchor);
                        i++;
                    }
                }
            }
            // 删除元素, 老得比新的长 abcd => adc (i=3 e1=3 e2=2)
            else if (i > e2) {
                console.log(i, e1, e2);
                // (i=2 e1=1, e2=0)
                while (i <= e1) {
                    hostRemove(oldChildren[i].el);
                    i++;
                }
            }
            // 无规律的情况
            else {
                // ab[cde]fg => ab[edch]fg (i=2 e1=4 e2=5)
                // ab[cde]fg i=2 => e1=4 之间需要diff
                // ab[edch]fg i=2 => e1=5 之间需要diff
                var start1 = i;
                var start2 = i;
                // 新的索引和key做成一个映射表
                var keyToNewIndexMap = new Map();
                for (var i_1 = start2; i_1 <= e2; i_1++) {
                    var nextChild = newChildren[i_1];
                    keyToNewIndexMap.set(nextChild.key, i_1);
                }
                var toBePatched = e2 - start2 + 1;
                var newIndexToOldMapIndex = new Array(toBePatched).fill(0);
                // console.log(keyToNewIndexMap)
                for (var i_2 = start1; i_2 <= e1; i_2++) {
                    var prevChild = oldChildren[i_2];
                    // 看老得孩子中有没有新孩子节点的key值， 如果有， 获取新的节点的索引.
                    var newIndex = keyToNewIndexMap.get(prevChild.key);
                    if (newIndex == undefined) {
                        // 老得没有， 新的直接删除
                        hostRemove(prevChild.el);
                    }
                    else {
                        newIndexToOldMapIndex[newIndex - start2] = i_2 + 1;
                        patch(prevChild, newChildren[newIndex], el);
                    }
                }
                // 更改位置
                for (var i_3 = toBePatched - 1; i_3 >= 0; i_3--) {
                    var nextIndex = start2 + i_3; // [e, d, c, h] // 找到h
                    var nextChild = newChildren[nextIndex];
                    var anchor = nextIndex + 1 < newChildren.length ? newChildren[nextIndex + 1].el : null;
                    // 说明这是一个新元素， 直接创建插入到当前元素的下一个
                    if (newIndexToOldMapIndex[i_3] === 0) {
                        patch(null, nextChild, el, anchor);
                    }
                    else {
                        // 根据参照物一次将节点直接移动过去
                        hostInsert(nextChild.el, el, anchor);
                    }
                }
                console.log(newIndexToOldMapIndex);
            }
            console.log(i, e1, e2);
        };
        var patchElement = function (oldVnode, vnode, container) {
            console.log(oldVnode, vnode);
            // 现比较属性， 在比较孩子
            var el = (vnode.el = oldVnode.el);
            // 更新属性
            var oldProps = oldVnode.props || {};
            var newProps = vnode.props || {};
            // 比对属性
            patchProps(oldProps, newProps, el);
            patchChild(oldVnode, vnode, el);
        };
        var mounteChildren = function (children, container) {
            for (var i = 0; i < children.length; i++) {
                patch(null, children[i], container);
            }
        };
        var mountComponent = function (initialVnode, container) {
            // 组件挂载逻辑
            /**
             * 1. 创建组件的实例， 组件实例要记录当前组件的状态
             * 2. 找到组件的render方法
             * 3. 执行render方法
             */
            initialVnode.component = createComponentInstance(initialVnode);
            // 初始化组件， 调用组件的setup方法
            setupComponent(initialVnode.component);
            console.log(initialVnode.component.render);
            // 调用render方法， 并且数据变化了， 会重新渲染
            setupRenderEffect(initialVnode.component, initialVnode, container); // 给组件创建一个effect, 等驾驭vue2中的watcher
        };
        var setupRenderEffect = function (instance, initialVnode, container) {
            effect(function componentEffect() {
                if (!instance.isMounted) {
                    // 渲染组件中的内容
                    var subTree = instance.subTree = instance.render(); // 组件对应的渲染结果
                    patch(null, subTree, container);
                    instance.isMounted = true;
                }
                else {
                    // 更新逻辑
                    var prev = instance.subTree; // 上一次的渲染结果
                    var next = instance.render();
                    patch(prev, next, container);
                }
            });
        };
        var processElement = function (oldVnode, vnode, container, anchor) {
            if (!oldVnode) {
                mountElement(vnode, container, anchor);
            }
            else {
                // 比较两个虚拟节点
                patchElement(oldVnode, vnode);
            }
        };
        var processComponent = function (oldVnode, vnode, container) {
            // console.log(oldVnode, vnode)
            if (oldVnode == null) {
                mountComponent(vnode, container);
            }
        };
        var isSameVnodeType = function (oldVnode, vnode) {
            return oldVnode.type === vnode.type && oldVnode.key === vnode.key;
        };
        var patch = function (oldVnode, vnode, container, anchor) {
            var shapeFlag = vnode.shapeFlag;
            // 如果不是第一次渲染， 并且标签不同， 直接移除掉
            if (oldVnode && !isSameVnodeType(oldVnode, vnode)) {
                // 删除老节点
                hostRemove(oldVnode.el);
                oldVnode = null;
            }
            if (shapeFlag & 1 /* ELEMENT */) {
                processElement(oldVnode, vnode, container, anchor);
            }
            else if (shapeFlag & 4 /* STATEFUL_COMPONENT */) {
                // 比较两个虚拟节点
                processComponent(oldVnode, vnode, container);
            }
        };
        return {
            createApp: createAppApi(render)
        };
    }

    function h(type, props, children) {
        if (props === void 0) { props = {}; }
        if (children === void 0) { children = null; }
        return createVnode(type, props, children);
    }

    var nodeOps = {
        createElement: function (type) {
            return document.createElement(type);
        },
        setElementText: function (el, text) {
            return el.textContent = text;
        },
        insert: function (child, parent, anchor) {
            if (anchor === void 0) { anchor = null; }
            parent.insertBefore(child, anchor);
        },
        remove: function (child) {
            var parent = child.parentNode;
            if (parent) {
                parent.removeChild(child);
            }
        }
    };

    function patchClass(el, value) {
        if (value == null) {
            value = '';
        }
        el.className = value;
    }
    function patchStyle(el, prev, next) {
        var style = el.style;
        if (!next) {
            el.removeAttribute('style');
        }
        else {
            for (var key in next) {
                style[key] = next[key];
            }
            if (prev) {
                for (var key in prev) {
                    if (next[key] == null) {
                        style[key] = '';
                    }
                }
            }
        }
    }
    function patchAttr(el, key, value) {
        if (value == null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, value);
        }
    }
    function patchProp(el, key, prevValue, nextValue) {
        switch (key) {
            case 'class':
                patchClass(el, nextValue);
                break;
            case 'style':
                patchStyle(el, prevValue, nextValue);
                break;
            default:
                patchAttr(el, key, nextValue);
                break;
        }
    }

    function createApp(rootComponent) {
        // 根据组件， 创建一个渲染器
        var app = ensureRenderer().createApp(rootComponent);
        var mount = app.mount;
        app.mount = function (container) {
            container = document.querySelector(container);
            // 挂载时需要先把容器清空在挂载
            container.innderHTML = '';
            mount(container);
        };
        return app;
    }
    var renderOptions = __assign(__assign({}, nodeOps), { patchProp: patchProp });
    function ensureRenderer() {
        return createRenderer(renderOptions);
    }

    exports.computed = computed;
    exports.createApp = createApp;
    exports.createRenderer = createRenderer;
    exports.effect = effect;
    exports.h = h;
    exports.reactive = reactive;
    exports.ref = ref;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=vue.js.map
