// 空方法
export const NOOP = function() {};

// 匹配 [object XXX]
const objectReg = /^\[object ([A-Za-z0-9_]+)\]$/;

// 解析具体的object子类型
const getObjectType = (target) => {
  const result = objectReg.exec(String(target));
  if (result && result[1]) return result[1];
  return null;
};

// 是否是数组
export const isArray = target => Array.isArray(target);

// 是否是plainobject
export const isPlainObject = target => 
  typeof target === 'object'
  && target !== null
  && getObjectType(target) === 'Object';

// 获得所有的key（包括继承的）
export const getAllKeys = (target) => {
  let keys = new Set(Object.getOwnPropertyNames(target));
  let object = target;
  while ((object = object.__proto__) && object.constructor !== Object) {
    Object.getOwnPropertyNames(object).forEach(item => keys.add(item));
  }
  keys.delete('constructor');
  return Array.from(keys);
};

// 克隆对象
export const clone = (target) => {
  switch (typeof target) {
    case 'number':
    case 'string':
    case 'boolean':
      return target;
    case 'object':
      if (target === null) return target;
      
      // 数组
      if (isArray(target)) {
        return target.map(item => clone(item));
      }
      
      // 如果是普通对象
      const result = {};
      getAllKeys(target).forEach((name) => {
        const value = clone(target[name]);
        if (typeof value === 'undefined') return;
        result[name] = value;
      });
      return result;
    default:
      break;
  }
};

const isProxyObject = target => 
  target.constructor
  && target.constructor === Object;

// 在object中寻找
const findInObject = (data, keyTraveler) => {
  // TODO 现在只能处理 path.to.key，还处理不了 path[to].key这样的
  return keyTraveler.split('.').reduce((result, name) => result[name], data);
};

// 默认的混合属性方法
export const defaultMergeProps = (props, stateProps, methodProps) => ({
  ...props,
  ...stateProps,
  ...methodProps,
});

export const parseMapStateToProps = (contextState, mapStateToProps) => {
  const props = {};

  if (isArray(mapStateToProps)) {
    mapStateToProps.forEach((name) => {
      props[name] = findInObject(contextState, name);
    });
  } else if (typeof mapStateToProps === 'object' && mapStateToProps !== null) {
    Object.keys(mapStateToProps).forEach((propName) => {
      const value = mapStateToProps[propName];
      
      switch (typeof value) {
        case 'string':
          // 针对这种格式： propName: 'path.to.key'
          props[propName] = findInObject(contextState, value);
          break;
        case 'function':
          props[propName] = value(contextState);
          break;
        default:
          break;
      }
    });
  }

  return props;
};

export const parseMapMethodToProps = (contextMethods, contextState, mapMethodToProps) => {
  const props = {};

  if (isArray(mapMethodToProps)) {
    mapMethodToProps.forEach((methodName) => {
      props[methodName] = contextMethods[methodName];
    });
  } else if (typeof mapMethodToProps === 'object' && mapMethodToProps !== null) {
    Object.keys(mapMethodToProps).forEach((propName) => {
      const value = mapMethodToProps[propName];
      
      switch (typeof value) {
        case 'string':
          // 针对这种格式： propName: 'methodName'
          props[propName] = contextMethods[value];
          break;
        case 'function':
          props[propName] = value.bind(null, contextMethods, contextState);
          break;
        default:
          break;
      }
    });
  }

  return props;
};

export default {
  isArray,
  isPlainObject,
  clone,
  getAllKeys,
  NOOP,
  parseMapStateToProps,
  parseMapMethodToProps,
};
