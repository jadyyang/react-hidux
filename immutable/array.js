import { 
  isArray,
  isPlainObject,
  NOOP,
} from '../util';
import PlainObjectImmutable from './plainobject';


// 给指定的方法增加一些参数
const joinArgs = (func, ...args) => {
  return function(...calledArgs) {
    return func.apply(this, args.concat(calledArgs));
  };
};

// 替身方法
const ReplacedMethods = {
  push({ dataProps, namespaceList, onlyProxyedProps }, ...args) {
    // FIXME 如果当前的this上下文不是目标对象怎么办？
    let index = this.length;

    // 调用对应的方法
    const result = Array.prototype.push.apply(this, args);

    // 如果是复杂数据类型，那就需要特殊处理之
    args.forEach((value, i) => {
      tryToProxyIt(value, (index + i), dataProps, namespaceList, onlyProxyedProps);
    });

    // 重新获取下props，是为了重新获取下对象，因为值已经发生了变更
    dataProps.change('array:push', namespaceList.concat([index]), args);

    return result;
  },

  pop({ dataProps, namespaceList, onlyProxyedProps }) {
    // FIXME 如果当前的this上下文不是目标对象怎么办？
    let index = this.length - 1;

    // 调用对应的方法
    const result = Array.prototype.pop.apply(this);

    // 清除对应的proxyed的对象
    unProxy(onlyProxyedProps, index)

    // 重新获取下props，是为了重新获取下对象，因为值已经发生了变更
    dataProps.change('array:pop', namespaceList.concat([index]));

    return result;
  },

  unshift({ dataProps, namespaceList, onlyProxyedProps }, ...args) {
    // FIXME 如果当前的this上下文不是目标对象怎么办？
    const count = args.length;

    // 调用对应的方法
    const result = Array.prototype.unshift.apply(this, args);

    // 把后面的每一项往后移
    Object.keys(onlyProxyedProps).reverse().forEach(name => {
      const proxy = onlyProxyedProps[name];
      const index = parseInt(name, 10);
      const newIndex = index + count;
      
      // 逐个移动
      proxy._RESETNAMESPACE_(namespaceList.concat([newIndex]));
      onlyProxyedProps[newIndex] = proxy;
    });

    // 如果是复杂数据类型，那就需要特殊处理之
    args.forEach((value, i) => {
      tryToProxyIt(value, i, dataProps, namespaceList, onlyProxyedProps);
    });

    // 重新获取下props，是为了重新获取下对象，因为值已经发生了变更
    dataProps.change('array:unshift', namespaceList.concat([0]), args);

    return result;
  },

  shift({ dataProps, namespaceList, onlyProxyedProps }) {
    // FIXME 如果当前的this上下文不是目标对象怎么办？

    // 调用对应的方法
    const result = Array.prototype.shift.apply(this);

    // 清除对应的proxyed的对象
    unProxy(onlyProxyedProps, 0);

    // 把后面的每一项往前移
    Object.keys(onlyProxyedProps).forEach(name => {
      const proxy = onlyProxyedProps[name];
      const index = parseInt(name, 10);
      const newIndex = index - 1;
      
      // 逐个移动
      proxy._RESETNAMESPACE_(namespaceList.concat([newIndex]));
      onlyProxyedProps[newIndex] = proxy;
    });

    // 重新获取下props，是为了重新获取下对象，因为值已经发生了变更
    dataProps.change('array:shift', namespaceList.concat([0]));

    return result;
  },

  // FIXME 还需要考虑splice等别的方法
};

// proxy化复杂数据类型
const tryToProxyIt = (value, name, dataProps, namespaceList, onlyProxyedProps) => {
  if (typeof value !== 'object' || value === null) return;
  
  if (isArray(value)) {
    onlyProxyedProps[name] = immutable(value, dataProps, namespaceList.concat([name]));  
  } else if (isPlainObject(value)) {
    onlyProxyedProps[name] = PlainObjectImmutable(value, dataProps, namespaceList.concat([name]));
  } else {
    console.warn(`react-hidux框架还不支持当前的${String(value)}数据类型`);
  }
};

// 去proxy化
const unProxy = (parentProxy, name) => {
  // 删除对应的proxy
  const proxy = parentProxy[name];
  if (!proxy) return;
  delete parentProxy[name];

  // 设置当前的proxy无效
  proxy._DESTROYPROXY_();
};

const immutable = (target, dataProps, namespaceList) => {
  let onlyProxyedProps = {}; // 只包含被proxy化的属性值

  // 遍历所有属性，递进式proxy化所有深层次属性值
  target.forEach((item, index) => {
    tryToProxyIt(item, index, dataProps, namespaceList, onlyProxyedProps);
  });

  let warnInvalidProxy = NOOP;

  // 销毁方法
  const _DESTROYPROXY_ = () => {
    warnInvalidProxy = () => console.warn('使用了已经失效的proxy，请检查代码');
    Object.keys(onlyProxyedProps).forEach(name => {
      const proxyItem = onlyProxyedProps[name];
      delete onlyProxyedProps[name];

      dataProps = null;
      proxyItem._DESTROYPROXY_();
    });
    onlyProxyedProps = null;
  };

  // 更新namespace
  const _RESETNAMESPACE_ = (newNamespaceList) => {
    namespaceList = newNamespaceList;
    Object.keys(onlyProxyedProps).forEach(name => {
      onlyProxyedProps[name]._RESETNAMESPACE_(namespaceList.concat([name]));
    });
  };

  // 构建当前对象的proxy对象
  const proxy = new Proxy(target, {
    // 获取某个属性值
    get(target, name) {
      warnInvalidProxy();
      if (name === '_DESTROYPROXY_') return _DESTROYPROXY_;
      if (name === '_RESETNAMESPACE_') return _RESETNAMESPACE_;
      
      // 如果是替身方法，那就处理之
      if (ReplacedMethods.hasOwnProperty(name) && typeof ReplacedMethods[name] === 'function') {
        return joinArgs(ReplacedMethods[name], {
          dataProps,
          namespaceList,
          onlyProxyedProps,
        });
      }
      
      return onlyProxyedProps[name] || target[name];
    },

    // 设置某个属性
    set(target, name, value) {
      warnInvalidProxy();
      const isOldProp = name in target; // 是不是原有属性

      // 如果修改的值没有变化那就忽略之
      if (isOldProp && value === target[name]) return true;
      // FIXME 需要处理 NaN !== NaN 的情况
      // FIXME 需要考虑原来没有该属性，后来设置了undefined的情况

      // 如果不需要的值之前被proxy化过，需要unproxy化
      unProxy(onlyProxyedProps, name);

      // 如果设置的属性值是length，而且长度在缩减，
      // 那就需要确认下之前有没有被proxy过的对象，有的话就需要unproxy化
      if (name === 'length' && value < target.length) {
        Object.keys(onlyProxyedProps).forEach((name) => {
          const index = parseInt(name, 10);
          if (index >= value) {
            // 这一项已经被删除了
            unProxy(onlyProxyedProps, name);
          } 
        });
      }

      // FIXME 需要考虑，如果新设置的值就是一个proxy
      // FIXME 尤其是当期就是本框架创建的proxy对象，需要特别处理之
      
      // 修改到实际对象上
      target[name] = value;

      // 如果是复杂数据类型，那就需要特殊处理之
      tryToProxyIt(value, name, dataProps, namespaceList, onlyProxyedProps);

      // 重新获取下props，是为了重新获取下对象，因为值已经发生了变更
      dataProps.change('set', namespaceList.concat([name]), value);

      return true;
    },

    // 删除一个属性
    deleteProperty(target, name) {
      warnInvalidProxy();

      // 如果不需要的值之前被proxy化过，需要unproxy化
      unProxy(onlyProxyedProps, name);

      delete target[name];

      // 重新获取下props，是为了重新获取下对象，因为值已经发生了变更
      dataProps.change('delete', namespaceList.concat([name]));

      return true;
    },
  });
  
  return proxy;
};

export default immutable;
