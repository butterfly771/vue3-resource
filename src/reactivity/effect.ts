import { isArray, isInteger } from "../shared/index";

export function effect(fn, options: any = {}) {
    
    const effect = createReactiveEffect(fn, options);

    if(!options.lazy) {
        effect()
    }

    return effect
} 

window['activeEffect'] = window['activeEffect'] ? window['activeEffect'] : undefined; // 用来存储当前的effect函数
let uid = 0;
const effectStack  = [];

function createReactiveEffect(fn, options) {
    const effect = function() {
        // 防止重复更新， 防止递归执行
        if(!effectStack.includes(effect)) {
            
            try {
                window['activeEffect'] = effect
                effectStack.push(window['activeEffect'])
                // console.log('activeEffect', window['activeEffect'])
                return fn(); // 用户自己写的逻辑, 内部会对数据进行取值操作， 在取值的时候， 可以拿到这个activeEffect
            }finally {
                effectStack.pop()
                window['activeEffect'] = effectStack[effectStack.length - 1]
            }
        }
        
        
    }

    effect.id = uid++;
    effect.deps = [] // 用来表示effect中依赖了那些属性
    effect.options = options;

    return effect;
}

const targetMap = new WeakMap();
// 将属性和effec作一个关联
export function track(target, key, effect?) {
    // console.log('activeEffect', window['activeEffect'])

    if(window['activeEffect'] === undefined) {
        return;
    }
    // {}
    let depsMap = targetMap.get(target);

    if(!depsMap) {
        // { object: {} }
        targetMap.set(target, (depsMap = new Map()))
    }

    // { object: {a: [effect]} }
    let dep = depsMap.get(key);

    if(!dep) {
        depsMap.set(key, (dep = new Set()))
    }

    if(!dep.has(window['activeEffect'])) { // 如果没有effect， 就把effect放入到集合中
        dep.add(window['activeEffect']);

        window['activeEffect'].deps.push(dep);
    }

    // console.log(targetMap )
}

// 触发更新
export function trigger(target, type, key, value?, oldValue?) {
    // 判断这个目标有没有收集到依赖
    const depsMap = targetMap.get(target);

    if(!depsMap) { return }

    const run = effects => {
        if(effects) effects.forEach(effect => effect())
    }

    // 数组有特殊的情况
    if(key === 'length' && isArray(target)) {
        depsMap.forEach((dep, key) => {
            // 如果改的长度小于数组原有的长度， 应该更新试图
            if(key === 'length'  || key >= value) {
                run(dep);
            }
        })
    }else {
        // 说明修改了key
        if(key !== void 0) {
            // 获取到相应的effect
            run(depsMap.get(key))
        }

        switch(type) {
            case 'add': 
                // 给数组通过索引增加选项
                if(isArray(target)) {
                    if(isInteger(key)) {
                        // 如果页面中直接使用了数组， 也会对数组进行取值操作， 会对length进行收集， 新增属性是直接
                        // 触发length即可
                        run(depsMap.get('length'))
                    }
                }
                break;
            default: 
                break;
        }
    }

    
}