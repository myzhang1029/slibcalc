// pages/pc/pc.js
var sbl = require("../../utils/libsbl.js");
Page({
  /**
   * Page initial data
   */
  data: {
    value1: undefined,
    value2: undefined
  },

  form1Submit: function (e) {
    this.setData({
      value1: "结果是：" + sbl._slib_permu(e.detail.value["r"], e.detail.value["n"])
    });
  },
  
  form2Submit: function (e) {
    this.setData({
      value2: "结果是：" + sbl._slib_combi(e.detail.value["r"], e.detail.value["n"])
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