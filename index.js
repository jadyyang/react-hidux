import React from 'react';
import { wrapDataClass } from './immutable';
import {
  defaultMergeProps,
  parseMapStateToProps,
  parseMapMethodToProps,
} from './util';


// 包装一个DataClass，变成一个组件对
export const wrap = (DataClass) => {
  const WrappedDataClass = wrapDataClass(DataClass);
  const Context = React.createContext();

  // FIXME 需要考虑如何把父组件给的属性值传递下去
  class Provider extends React.Component {
    constructor(props) {
      super(props);
      this.wrap(props.value);
    }

    wrap(value) {
      const instance = WrappedDataClass(value);
      this.instance = instance;

      this.methods = instance.$getMethods();
      this.state = instance.$getSnapshot();
      instance.$changed((state) => {
        this.setState(state);
      });
    }

    // TODO 这里需要考虑增加对 shouldComponentUpdate的使用

    componentWillUnmount() {
      const { instance } = this;
      this.instance = null;
      this.methods = null;

      instance.$destroy();
    }

    render() {
      const value = {
        state: this.state,
        methods: this.methods,
      };
      return (
        <Context.Provider value={value}>
          {this.props.children}
        </Context.Provider>
      );
    }
  }

  // FIXME 需要考虑comsume如何做性能优化
  const consume = (mapStateToProps, mapMethodToProps, mergeProps = defaultMergeProps) => 
    Component =>
      props => (
        <Context.Consumer>
          {
            (context) => {
              const stateProps = parseMapStateToProps(context.state, mapStateToProps);
              const methodProps = parseMapMethodToProps(context.methods, context.state, mapMethodToProps);
              const newProps = mergeProps(props, stateProps, methodProps);
              
              return React.createElement(
                Component,
                newProps,
              );
            }
          }
        </Context.Consumer>
      );

  return {
    Provider,
    consume,
  };
};

export default {
  wrap,
};
