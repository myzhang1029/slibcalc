// pages/ddn/ddn.js
var sbl = require("../../utils/libsbl.js");
Page({

  /**
   * Page initial data
   */
  data: {
    date: undefined,
    value: undefined
  },

  dateChange: function (e) {
    this.setData({
      date: e.detail.value,
      value: "结果是：" + sbl._slib_d2dn(e.detail.value.slice(0, 4), e.detail.value.slice(5, 7), e.detail.value.slice(8, 10))
    });
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {

  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  }
})