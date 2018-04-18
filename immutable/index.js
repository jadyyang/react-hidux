import {
  isArray,
  isPlainObject,
  clone,
  getAllKeys,
  NOOP,
} from '../util';
import PlainObjectImmutable from './plainobject';
import ArrayImmutable from './array';


// 获得所有的方法（并且绑定好this）
const getMethods = (target, names) => names.reduce((result, name) => {
  const value = target[name];
  if (typeof value !== 'function') return result;
  return {
    ...result,
    [name]: value.bind(target),
  };
}, {});

// 按照immutable的原则更新并生成新数据
const updateImmutable = (method, target, names, value) => {
  const propName = names.shift();

  let result;
  if (isArray(target)) {
    result = target.slice();
  } else {
    result = { ...target };
  }

  if (names.length > 0) {
    // 不是最终要改的对象，那就往下immutable
    result[propName] = updateImmutable(method, target[propName], names, value);
  } else {
    // 这就是末端了
    switch (method) {
      case 'set':
        // 更新属性
        result[propName] = value;
        break;
      case 'delete':
        // 删除属性
        delete result[propName];
        break;
      case 'array:push':
        result.push.apply(result, value);
        break;
      case 'array:pop':
        result.pop();
        break;
      case 'array:unshift':
        result.unshift.apply(result, value);
        break;
      case 'array:shift':
        result.shift();
        break;
      default: 
        console.warn(console.warn(`未知method类型： ${method}`));
    }
  }

  return result;
};

// 包装一个数据类，变成一个经过包装的新类
export const wrapDataClass = (DataClass) => {
  return function(initValue) {
    // 记录state发生变化时，应该回调的方法
    let onChange = NOOP;

    // 构建数据实例
    const instance = typeof initValue === 'undefined'
      ? new DataClass()
      : new DataClass(initValue);
    let dataProps = {
      // 用于存储按照不可变原则处理过之后的数据对象
      immutable: clone(instance),

      // 更新值的方法
      change(method, propKeys, value) {
        this.immutable = updateImmutable(method, this.immutable, propKeys.slice(), clone(value))
        onChange(this.immutable);
      },
    };

    // 构建经过代理的数据实例对象
    let proxyedInstance = PlainObjectImmutable(instance, dataProps, []);
    let methods = getMethods(proxyedInstance, getAllKeys(instance));

    return {
      $getMethods() {
        return methods;
      },
      $getSnapshot() {
        return dataProps.immutable;
      },
      $changed(callback) {
        onChange = callback;
      },
      $destroy() {
        dataProps.change = NOOP;
        dataProps = null;
        proxyedInstance = null;
        methods = null;
        onChange = null;
      },
    };
  };
};

export default {
  wrapDataClass,
};
