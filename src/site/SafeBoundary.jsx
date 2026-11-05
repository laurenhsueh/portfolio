import { Component } from 'react'

/** Renders nothing if its children throw (e.g. no WebGL, or the 3D model fails), so the page goes on. */
export default class SafeBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}
