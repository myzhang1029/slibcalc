// pages/index/index.js
//获取应用实例
const app = getApp()

var sbl = require("../../utils/libsbl.js");
var hlp = require("../../utils/helper.js");

Page({

  /**
   * Page initial data
   */
  data: {
    value: "Error",
    value1: "Error",
    value2: "Error",
    showFct: false,
    showPc1: false,
    showPc2: false,
    showDdn: false,
    showD2r: false,
    showR2d: false,
    showHms1: false,
    showHms2: false,
    showElr: false,
    showGcf: false,
    showLcm: false,
    showPrt: false,
    showPt: false,
    showRp: false,
    showJd1: false,
    showJd2: false,
    showSs: false,
    showSd: false,
  },

  fct_formSubmit: function(e) {
    this.setData({
      fct_value: "结果是：" + sbl._slib_factorial(e.detail.value["num"])
    });
  },

  pc_form1Submit: function(e) {
    this.setData({
      pc_value1: "结果是：" + sbl._slib_permu(e.detail.value["r"], e.detail.value["n"])
    });
  },

  pc_form2Submit: function(e) {
    this.setData({
      pc_value2: "结果是：" + sbl._slib_combi(e.detail.value["r"], e.detail.value["n"])
    });
  },

  ddn_dateChange: function(e) {
    this.setData({
      ddn_date: e.detail.value,
      ddn_value: "结果是：" + sbl._slib_d2dn(e.detail.value.slice(0, 4), e.detail.value.slice(5, 7), e.detail.value.slice(8, 10))
    });
  },

  d2r_formSubmit: function(e) {
    this.setData({
      d2r_value: "结果是：" + sbl._slib_deg2rad(e.detail.value["deg"])
    });
  },

  r2d_formSubmit: function(e) {
    this.setData({
      r2d_value: "结果是：" + sbl._slib_rad2deg(e.detail.value["rad"])
    });
  },

  hms_form1Submit: function(e) {
    let h = e.detail.value["h"];
    hlp._wrap_h2hms(h, this.setData, sbl._slib_h2hms);
  },

  hms_form2Submit: function(e) {
    this.setData({
      hms_value2: "结果是：" + sbl._slib_hms2h(e.detail.value["h"], e.detail.value["m"], e.detail.value["s"])
    });
  },

  elr_formSubmit: function(e) {
    this.setData({
      elr_value: "结果是：" + sbl._slib_eular(e.detail.value["num"])
    });
  },

  gcf_formSubmit: function(e) {
    this.setData({
      gcf_value: "结果是：" + sbl._slib_gcf(e.detail.value["num1"], e.detail.value["num2"])
    });
  },

  lcm_formSubmit: function(e) {
    this.setData({
      lcm_value: "结果是：" + sbl._slib_lcm(e.detail.value["num1"], e.detail.value["num2"])
    });
  },

  prt_formSubmit: function(e) {
    var pList = sbl._malloc(4 * e.detail.value["n"]);
    var list = [];
    sbl._slib_pnlst(e.detail.value["min"], pList, e.detail.value["n"]);
    for (var i = 0; i < e.detail.value["n"]; i++) {
      list[i] = sbl.getValue(pList + i * 4, 'i32');
    }
    this.setData({
      prt_value: list
    })
    sbl._free(pList);
  },

  pt_formSubmit: function(e) {
    var result = "";
    if (sbl._slib_ispn(e.detail.value["num"]) == 0) {
      result = "不";
    }
    this.setData({
      pt_value: "该数" + result + "是质数"
    });
  },

  rp_formSubmit: function(e) {
    var result = "";
    if (sbl._slib_isrp(e.detail.value["num1"], e.detail.value["num2"]) == 0) {
      result = "不";
    }
    this.setData({
      rp_value: "该两数" + result + "互质"
    });
  },

  sd_formSubmit: function(e) {
    this.setData({
      sd_value: "结果是：" + sbl._slib_sun_decl_by_date(e.detail.value["dn"])
    });
  },

  onReset: function(e) {
    this.setData({
      fct_value: "",
      pc_value1: "",
      pc_value2: "",
      ddn_date: "",
      ddn_value: "",
      d2r_value: "",
      r2d_value: "",
      hms_value1: "",
      hms_value2: "",
      elr_value: "",
      gcf_value: "",
      lcm_value: "",
      prt_value: "",
      pt_value: "",
      rp_value: "",
      jd_value1: "",
      jd_value2: "",
      ss_value: "",
      sd_value: ""
    });
  },

  toggleShow: function(e) {
    let opt = e.target.dataset.param;
    switch (opt) {
      case "Fct":
        this.setData({
          showFct: !this.data.showFct
        });
        break;
      case "Pc1":
        this.setData({
          showPc1: !this.data.showPc1
        });
        break;
      case "Pc2":
        this.setData({
          showPc2: !this.data.showPc2
        });
        break;
      case "Ddn":
        this.setData({
          showDdn: !this.data.showDdn
        });
        break;
      case "D2r":
        this.setData({
          showD2r: !this.data.showD2r
        });
        break;
      case "R2d":
        this.setData({
          showR2d: !this.data.showR2d
        });
        break;
      case "Hms1":
        this.setData({
          showHms1: !this.data.showHms1
        });
        break;
      case "Hms2":
        this.setData({
          showHms2: !this.data.showHms2
        });
        break;
      case "Elr":
        this.setData({
          showElr: !this.data.showElr
        });
        break;
      case "Gcf":
        this.setData({
          showGcf: !this.data.showGcf
        });
        break;
      case "Lcm":
        this.setData({
          showLcm: !this.data.showLcm
        });
        break;
      case "Prt":
        this.setData({
          showPrt: !this.data.showPrt
        });
        break;
      case "Pt":
        this.setData({
          showPt: !this.data.showPt
        });
        break;
      case "Rp":
        this.setData({
          showRp: !this.data.showRp
        });
        break;
      case "Jd1":
        this.setData({
          showJd1: !this.data.showJd1
        });
        break;
      case "Jd2":
        this.setData({
          showJd2: !this.data.showJd2
        });
        break;
      case "Ss":
        this.setData({
          showSs: !this.data.showSs
        });
        break;
      case "Sd":
        this.setData({
          showSd: !this.data.showSd
        });
        break;
    }
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function(options) {

  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function() {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function() {

  }
})
