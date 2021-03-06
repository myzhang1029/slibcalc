// pages/index/index.js
//获取应用实例
const app = getApp()

var sbl = require("../../utils/libsbl.js");

Page({

  /**
   * Page initial data
   */
  data: {
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
    ss_lat: "",
    ss_lon: "",
    ss_elev: "",
    ss_tz: "",
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
    var h = e.detail.value["h"];
    var poh = sbl._malloc(8);
    var pom = sbl._malloc(8);
    var pos = sbl._malloc(8);
    sbl._slib_h2hms(h, poh, pom, pos);
    var oh = sbl.getValue(poh, "double");
    var om = sbl.getValue(pom, "double");
    var os = sbl.getValue(pos, "double");
    this.setData({
      hms_value1: "结果是：" + oh + ":" + om + ":" + os
    });
    sbl._free(poh);
    sbl._free(pom);
    sbl._free(pos);
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

  jd_form1Submit: function(e) {
    var tm = sbl._malloc(44);
    sbl._slib_jd2tm(e.detail.value["jd"], tm);
    var sec = sbl.getValue(tm, 'i32');
    var min = sbl.getValue(tm + 4, 'i32');
    var hour = sbl.getValue(tm + 8, 'i32');
    var mday = sbl.getValue(tm + 12, 'i32');
    var mon = sbl.getValue(tm + 16, 'i32') + 1;
    var year = sbl.getValue(tm + 20, 'i32') + 1900;
    this.setData({
      jd_value1: "结果是：" + year + "/" + mon + "/" + mday + " " + hour + ":" + min + ":" + sec
    });
    sbl._free(tm);
  },

  jd_date2Change: function(e) {
    this.setData({
      jd_date2: e.detail.value
    });
  },

  jd_time2Change: function(e) {
    this.setData({
      jd_time2: e.detail.value
    });
  },

  jd_form2Submit: function(e) {
    var hour, min, year, mon, mday;
    var v = e.detail.value;
    if (v["date"] == null) {
      this.setData({
        jd_value2: "日期未填"
      });
      return;
    } else {
      year = v["date"].slice(0, 4);
      mon = v["date"].slice(5, 7);
      mday = v["date"].slice(8, 10);
    }
    if (v["time"] == null) {
      hour = 12;
      min = 0;
    } else {
      hour = v["time"].slice(0, 2);
      min = v["time"].slice(3, 5);
    }
    var tm = sbl._malloc(44);
    sbl.setValue(tm, 0, 'i32');
    sbl.setValue(tm + 4, min, 'i32');
    sbl.setValue(tm + 8, hour, 'i32');
    sbl.setValue(tm + 12, mday, 'i32');
    sbl.setValue(tm + 16, mon, 'i32') - 1;
    sbl.setValue(tm + 20, year, 'i32') - 1900;
    var jd = sbl._slib_tm2jd(tm);
    this.setData({
      jd_value2: jd
    });
    sbl._free(tm);
  },

  ss_dateChange: function(e) {
    this.setData({
      ss_date: e.detail.value
    });
  },

  ss_formSubmit: function(e) {
    var v = e.detail.value;
    if (v["date"] == null) {
      this.setData({
        ss_value: "日期未填"
      });
      return;
    }
    var tmnow = sbl._malloc(44);
    var tmrise = sbl._malloc(44);
    var tmset = sbl._malloc(44);
    var y = v["date"].slice(0, 4);
    var m = v["date"].slice(5, 7);
    var d = v["date"].slice(8, 10);
    /* In emscripten/incoming/system/include/libc/time.h:
     * struct tm {
     *     int tm_sec;
     *     int tm_min;
     *     int tm_hour;
     *     int tm_mday;
     *     int tm_mon;
     *     int tm_year;
     *     int tm_wday;
     *     int tm_yday;
     *     int tm_isdst;
     *     long __tm_gmtoff;
     *     const char *__tm_zone;
     * };
     * And sizeof(int) is 4.
     */
    for (var i = 0; i < 9; i++) {
      sbl.setValue(tmnow + i * 4, 0, 'i32');
    }
    sbl.setValue(tmnow + 12, d, 'i32');
    sbl.setValue(tmnow + 16, m - 1, 'i32');
    sbl.setValue(tmnow + 20, y - 1900, 'i32');
    sbl._slib_sf_sunrise(v["lat"], v["lon"], v["elev"], v["tz"], tmnow, tmrise, tmset);
    var h1, min1, s1, h2, min2, s2;
    h1 = sbl.getValue(tmrise + 8, "i32");
    min1 = sbl.getValue(tmrise + 4, "i32");
    s1 = sbl.getValue(tmrise, "i32");
    h2 = sbl.getValue(tmset + 8, "i32");
    min2 = sbl.getValue(tmset + 4, "i32");
    s2 = sbl.getValue(tmset, "i32");
    this.setData({
      ss_value: "日出时间：" + h1 + ":" + min1 + ":" + s1 + "\n" + "日落时间：" + h2 + ":" + min2 + ":" + s2
    });
    sbl._free(tmnow);
    sbl._free(tmrise);
    sbl._free(tmset);
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
      sd_value: "",
      ss_lat: "",
      ss_lon: "",
      ss_elev: "",
      ss_tz: "",
    });
  },

  getLocation: function(e) {
    var d = new Date();
    var lat, lon, elev, tz = d.getTimezoneOffset() / 60;
    var that = this;
    wx.authorize({
      scope: 'scope.userLocation',
      success() {
        wx.getLocation({
          type: "wgs84",
          altitude: "true",
          success(res) {
            that.setData({
              ss_lat: res.latitude,
              ss_lon: res.longitude,
              ss_elev: res.altitude,
              ss_tz: -tz
            });
          },
          fail(e) {
            that.setData({
              ss_value: "位置请求失败"
            });
          }
        });
      },
      fail(e) {
        that.setData({
          ss_value: "位置请求被拒绝"
        });
      }
    });
  },

  toggleShow: function(e) {
    var opt = e.target.dataset.param;
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
        wx.pageScrollTo({
          scrollTop: 1000,
          duration: 0
        })
        break;
    }
  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function() {
    this.onReset();
    this.setData({
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
    });
  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function() {

  }
})