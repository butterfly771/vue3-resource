import { hasChanged, hasOwn, isArray, isInteger, isObject, isSymbol } from "../shared/index";
import { track, trigger } from "./effect";
import { reactive } from "./reactive";


function createGetter() {
    return function get(target, key, receiver) {
        const res = Reflect.get(target, key, receiver);

        // 如果取得是symbol类型， 直接忽略它
        if(isSymbol(res)) {
            return res
        }

        // 依赖收集
        // console.log('此时进行了数据获取操作')
        track(target, key)
        // 取值的时候才递归
        if(isObject(res)) {
            return reactive(res)
        }
        return res
    }
}

function createSetter() {
    return function set(target, key, value, receiver) {
        // vue2不支持新增属性

        // 那么这个时候怎么知道是新增还是修改呢
        const oldValue = target[key] // 如果是修改， 那么肯定是有老值的 


        // 第一种是数组新增的逻辑， 第二种是对象的逻辑 

        // 检查一下有没有这个属性
        // 满足条件是数组并且修改了
        const hasKey = 
            isArray(target) && isInteger(key) ? Number(key) < target.length 
            : 
            // 如果是对象的话判断有没有属性
            hasOwn(target, key)
        ;

        const result = Reflect.set(target, key, value, receiver);

        if(!hasKey) {
            // console.log('新增属性')
            trigger(target, 'add', key, value)
        }else if(hasChanged(value, oldValue)){
            // console.log('修改属性')
            trigger(target, 'set', key, value, oldValue)
        }

        return result
    }
}

const get = createGetter(); // 预置参数
const set = createSetter()


export const mutableHandlers = {
    // 获取对象中的属性会执行此方法
    get,

    // 设置对象中的属性会执行此方法
    set,
}