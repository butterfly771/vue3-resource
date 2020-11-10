import { isObject } from "../shared/index"
import { mutableHandlers } from "./baseHandler";




export function reactive(target) {
    // 需要把目标变为响应式对象，Proxy
    return createReactiveObject(target, mutableHandlers)    
}

const proxyMap = new WeakMap();
// 核心操作就是读取文件的时候做依赖收集。 数据变化的时候重新执行effect
function createReactiveObject(target, baseHandlers) {
    // 如果不是对象， 直接返回
    if(!isObject(target)) {
        return target
    }

    const existingProxy = proxyMap.get(target);

    if(existingProxy) {
        return existingProxy
    }

    // 只对对外称对象做代理， 默认不会递归， 而且不会重写对象中的属性
    const proxy = new Proxy(target, baseHandlers)

    // 将代理的对象和代理后的结果做一个映射表
    proxyMap.set(target, proxy);

    // 如果是对象， 返回被代理的对象
    return proxy
}