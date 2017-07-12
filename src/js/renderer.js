var ipcRenderer = require('electron').ipcRenderer;
var cp = require('child_process');
var iconv = require('iconv-lite');
var draggable = require('vuedraggable');
var {
  shell
} = require('electron');

var vm = new Vue({
  el: "#app",
  data: {
    appData: {
      list: [],
      children: [],
      sysConf: {
        tempPath: '',
        cmdPath: ''
      }
    },
    currData: {},
    formData: {
      id: '',
      title: '',
      filePath: '',
      cmd_dev: '',
      cmd_build: '',
      otherCommand: []
    },
    sysFormData: {
      tempPath: '',
      cmdPath: ''
    },
    processData: '',
    input_cmd: '',
    showModify: false,
    showConf: false,
    confirm: {
      show: false,
      title: '',
      sure: function() {},
      cancel: function() {}
    },
    dragger: {
      timer: "",
      move_y: "",
      down_y: "",
      to_y: ""
    },
    clearTimer: "",
    time: ""
  },
  mounted() {
    var _this = this;

    this.getAppData();

    this.clearProcessInfo(true);
    // error caught
    process.on('uncaughtException', function(error) {
      _this.displayProcess("[error caught]" + this.gbk(error), 'error');
    });

  },

  methods: {

    getAppData() {
      this.appData = JSON.parse(localStorage.getItem("appData")) || {
        list: [],
        children: [],
        sysConf: {
          tempPath: '',
          cmdPath: ''
        }
      }

      // 兼容迭代数据结构变化
      if (!this.appData.list) this.appData.list = [];
      if (!this.appData.children) this.appData.children = [];
      if (!this.appData.sysConf) this.appData.sysConf = {
        tempPath: '',
        cmdPath: ''
      };
      if (!this.appData.sysConf.tempPath) this.appData.sysConf.tempPath = '';
      if (!this.appData.sysConf.cmdPath) this.appData.sysConf.cmdPath = 'C:\\';

      // 清空上次pid
      this.clearPids();
      this.saveAppData();
    },

    clearPids() {
      this.appData.children = [];
    },

    saveAppData() {
      localStorage.setItem("appData", JSON.stringify(this.appData));
    },

    onDrag(e) {
      this.saveAppData();
    },

    /*
     * get real path
     */
    getFilePath(e, type) {
      for (var f of e.target.files) {
        if (type == 'projectPath') {
          this.formData.filePath = f.path;
        } else {
          this.sysFormData.cmdPath = f.path;
        }
      }
    },
    openFolder(path) {
      cp.exec('explorer ' + path);
      this.displayProcess('open folder: ' + path, 'done');
    },

    // 环境变量（临时）
    getTempPath() {
      var data = JSON.parse(localStorage.getItem("appData"));
      return (data.sysConf.tempPath ? "set path=%path%;" + (data.sysConf.tempPath || '') + "&&" : '')
    },

    task(id, path, command) {
      var _this = this;
      var cmd = this.getTempPath() + "cd/d " + path + "&&" + command;

      _this.displayProcess("ready...", 'done');

      var child = cp.exec(cmd, {
        encoding: "binary",
        maxBuffer: 4 * 1024 * 1024
      });

      child.stdout.on('data', (data) => {
        _this.displayProcess(data);
      })

      child.stderr.on('data', (data) => {
        _this.displayProcess(data, 'error', 'gb2312');
      })

      child.on('exit', (code) => {
        _this.displayProcess("======= done! =======", 'done');
      });

      // save pid
      for (var v of this.appData.list) {
        if (v.id === id) {
          this.appData.children.push({
            id: id,
            pid: child.pid
          });
          this.saveAppData();
        }
      }

    },

    // close process
    close(id) {
      var c = this.appData.children;
      var a = c.filter(function(v, i) {
        return v.id === id;
      });

      if (a.length == 0) {
        this.displayProcess("[ The process is not running !]", 'error');
        return;

      } else {

        for (var i = 0; i < c.length; i++) {
          if (c[i].id === id) {
            this.taskKill(c[i].pid);
            c.splice(i--, 1);
          }
        }
        this.saveAppData();
      }
    },

    taskKill(pid) {
      var _this = this;
      if (!pid) {
        _this.displayProcess('sorry! process pid is missing.', 'error');
        return;
      }

      var cmd = 'taskkill /PID ' + pid + ' /T /F';
      var child = cp.exec(cmd, {
        encoding: "binary",
        maxBuffer: 4 * 1024 * 1024
      })

      child.on('exit', (code) => {
        _this.displayProcess("[pid:" + pid + " killed successful! ]", 'done');
      });

    },

    // display result
    displayProcess(str, type, char) {
      this.scrollToBottom();
      var s = str.toString();
      switch (type) {
        case 'error':
          this.processData += '<div class="c-red">' + this.gbk(s, char) + '</div>';
          break;
        case 'done':
          this.processData += '<div class="c-green">' + this.gbk(s, char) + '</div>';
          break;
        default:
          this.processData += this.gbk(s, char) + '<br>';
          break;
      }
    },

    // copy project
    copy(id) {
      var list = this.appData.list;
      for (var i in list) {
        if (id === list[i].id) {
          var temp = this.clone(list[i]);
          temp.title = list[i].title + ".bak";
          temp.id = new Date().getTime();
          list.push(temp)
        }
      }
      this.saveAppData();
    },

    // delete project
    del(id) {
      var _this = this;
      this.confirm = {
        show: true,
        title: '确定要删除吗？',
        sure: () => {
          var list = _this.appData.list;
          for (var i in list) {
            if (id === list[i].id) {
              list.splice(i, 1);
            }
          }
          _this.confirm.show = false;
          _this.saveAppData();
        },
        cancel: function() {
          _this.confirm.show = false;
        }
      }
    },

    /*
     *open modify window
     */
    openModify(id) {
      if (id) {
        var list = this.appData.list;
        for (var i in list) {
          if (id === list[i].id) {
            this.currData = list[i];
            this.formData = this.clone(this.currData);
          }
        }
      } else {
        this.formData = {
          id: '',
          title: '',
          filePath: '',
          cmd_dev: '',
          cmd_build: '',
          otherCommand: []
        }
      }
      this.toggleShow("Modify");
    },

    // DIY cmd
    addOtherCmd() {
      var cmds = this.formData.otherCommand;

      if (cmds.length < 4) {
        cmds.push({
          name: "",
          command: ""
        })
      } else {
        this.toast("最多添加4条！");
      }
    },

    // delete diy cmd
    delOtherCmd(index) {
      var cmds = this.formData.otherCommand;
      cmds.splice(index, 1);
    },

    /*
     *save modify
     */
    saveModify(id) {
      // check
      var form = this.formCheck(this.formData);
      if (!form) return;

      var list = this.appData.list;

      if (id) {
        for (var i in list) {
          if (id === list[i].id) {
            list[i] = form;
          }
        }
      } else {
        form.id = Date.parse(new Date()) / 1000;
        list.push(form);
      }

      this.currData = form;
      this.toggleShow("Modify");
      this.saveAppData();
      this.toast("操作成功！");
    },

    cancelModify() {
      this.toggleShow('Modify');
    },

    // form check
    formCheck(obj) {
      if (!obj.title) {
        this.toast("项目名称必填！");
        return;
      }

      if (!obj.filePath) {
        this.toast("项目路径必填！");
        return;
      }

      var cmdEmpty = obj.otherCommand.some(function(v, index, arr) {
        return !(v.name && v.command);
      })

      if (cmdEmpty) {
        this.toast("自定义指令填写不完整！");
        return;
      }

      return obj;
    },

    /*
     * 程序配置控制
     */
    openConf() {
      this.toggleShow("Conf");
      this.sysFormData = this.clone(this.appData.sysConf);
    },

    saveConf() {
      this.appData.sysConf = this.sysFormData;
      this.saveAppData();
      this.toggleShow("Conf");
      this.toast("操作成功！");
    },

    cancelConf() {
      this.toggleShow('Conf');
    },

    toggleShow(type) {
      if (type === 'Modify') {
        this.showModify = !this.showModify;
      } else {
        this.showConf = !this.showConf;
      }
    },


    /*
     * open new cmd
     */
    openCmd(path) {
      cp.exec("start cmd /k cd/d " + (path || 'c:\\'));
      this.displayProcess("start cmd", 'done');
    },

    clearProcessInfo(type) {
      this.clearTimer && clearInterval(this.clearTimer);
      this.time = 100;
      if (type) {
        this.clearTimer = setInterval(() => {
          if (this.time == 0) {
            this.processData = '';
            this.time = 100;
          } else {
            this.time--;
          }
        }, 1000)
      } else {
        this.time = 100;
        this.processData = '';
        this.clearProcessInfo(true);
      }
    },

    /*
     * clone object
     */
    clone(obj) {
      var o;
      if (typeof obj == "object") {
        if (obj === null) {
          o = null;
        } else {
          if (obj instanceof Array) {
            o = [];
            for (var i = 0, len = obj.length; i < len; i++) {
              o.push(this.clone(obj[i]));
            }
          } else {
            o = {};
            for (var j in obj) {
              o[j] = this.clone(obj[j]);
            }
          }
        }
      } else {
        o = obj;
      }
      return o;
    },

    // open url in brower
    openWebUrl(url) {
      shell.openExternal(url);
    },

    gbk(str, char) {
      return iconv.decode(new Buffer(str, 'binary'), char || 'utf-8');
    },

    scrollToBottom() {
      var b = document.getElementById('bottomLine');
      b.scrollIntoView();
    },

    // window control
    closeWin() {
      let c = this.appData.children || [];
      for (var i = 0; i < c.length; i++) {
        this.taskKill(c[i].pid);
      }
      this.clearPids();
      this.saveAppData();

      setTimeout(() => {
        ipcRenderer.send('window-all-closed');
      }, 100)
    },

    minWin() {
      ipcRenderer.send('min-window')
    },

    // drag process
    dragDown(e) {
      this.dragger.timer && clearInterval(this.dragger.timer);
      var box_H = this.$refs.process.offsetHeight;
      var down_y = e.pageY;

      this.dragger.timer = setInterval(() => {
        if (this.dragger.timer) {
          var to_y = down_y - this.dragger.move_y + box_H;
          if (to_y < 46) {
            to_y = 46
          } else if (to_y > 500) {
            to_y = 500
          }
          this.$refs.process.style.height = to_y + "px";
        }
      });
    },


    mouseMove(e) {
      this.dragger.move_y = e.pageY;
    },

    dragUp(e) {
      clearInterval(this.dragger.timer);
      this.dragger.timer = undefined;
    },


    /*
     * Toast
     */
    toast(msg, callback, time) {
      if (!document.getElementById('js-toast')) {
        var box = document.createElement("div"),
          span = document.createElement("span"),
          txt = document.createTextNode(msg);
        box.id = "js-toast";
        span.id = "js-toast-msg";
        box.className = "js-toast";
        span.appendChild(txt);
        box.appendChild(span);
        document.body.appendChild(box);
      }

      if (box.addEventListener) {
        box.addEventListener("touchmove", function(e) {
          e.preventDefault();
        })
      } else {
        box.attachEvent("ontouchmove", function(e) {
          window.event.returnValue = false;
        })
      }
      setTimeout(function() {
        document.body.removeChild(box);
        typeof callback === "function" && callback();
      }, (time ? time : 800));
    }
  },
  components: {
    draggable
  }
});