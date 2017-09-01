var hljs = require('highlight.js');
const electron = window.require('electron');
const ipcRenderer = electron.ipcRenderer;
const mathjs = require("mathjs")
const fs = electron.remote.require('fs');
const katex = require('katex');
const path = require('path');
const mime = require('mime');

let newMd = (opts, workingDir) => {
    const defaultSettings = {
        isPreview:false,
        html: true,
        linkify:true,
        typographer: false,
        breaks: true,
        checkbox: true,
        anchor: true,
        toc:true,
        tocLevels: [1,2,3,4],
        katex:true,
        smartarrows:true,
        alert: true,
        note: true,
        spoiler: true,
        url: true,
        youtube: true,
        graph: true,
    }

    const settings = opts ? {...defaultSettings, ...opts} : defaultSettings // merge received opts with default settings

    // basic markdown-it setting
    let md = require('markdown-it')({
        html: settings.html,
        linkify: settings.linkify,
        typographer: settings.typographer,
        breaks: settings.breaks,
        highlight: function(str, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(lang, str).value;
                } catch (__) {}
            }

            return ''; // use external default escaping
        }
    })

    // loading extra modules
    if (settings.checkbox){
        md.use(require('markdown-it-task-checkbox'))
    }
    if (settings.anchor){
        md.use(require("../utilities/markdown-it-anchor.js"))
    }
    if (settings.toc){
        md.use(require("markdown-it-table-of-contents"), {
            "includeLevel": settings.tocLevels
        })
    }
    if (settings.katex){
        md.use(require('../utilities/markdown-it-katex'), {
            "throwOnError": false,
            "errorColor": " #cc0000"
        })
    }

    if (settings.smartarrows){
        md.use(require('markdown-it-smartarrows'))
    }

    if (settings.alert){
        md.use(require('markdown-it-container'), 'alert', {

            validate: function(params) {
                return params.trim().match(/^alert\s+(.*)$/);
            },

            render: function(tokens, idx) {
                var m = tokens[idx].info.trim().match(/^alert\s+(.*)$/); // parse the arguments for the container

                if (tokens[idx].nesting === 1) {
                    // opening tag
                    return '<div class="md-container warning"><h3><i class="fa fa-exclamation-triangle" aria-hidden="true"></i> ' + md.utils.escapeHtml(m[1]) + '</h3>\n';

                } else {
                    // closing tag
                    return '</div>\n';
                }
            }
        });
    }

    if (settings.note){
        md.use(require('markdown-it-container'), 'note', {

            validate: function(params) {
                return params.trim().match(/^note\s+(.*)$/);
            },

            render: function(tokens, idx) {
                var m = tokens[idx].info.trim().match(/^note\s+(.*)$/); // parse the arguments for the container

                if (tokens[idx].nesting === 1) {
                    // opening tag
                    return '<div class="md-container note"><h3><i class="fa fa-info" aria-hidden="true"></i> ' + md.utils.escapeHtml(m[1]) + '</h3>\n';

                } else {
                    // closing tag
                    return '</div>\n';
                }
            }
        });
    }

    if (settings.spoiler){
        md.use(require('markdown-it-container'), 'spoiler', {

            validate: function(params) {
                return params.trim().match(/^spoiler\s+(.*)$/);
            },

            render: function(tokens, idx) {
                var m = tokens[idx].info.trim().match(/^spoiler\s+(.*)$/);

                if (tokens[idx].nesting === 1) {
                    // opening tag
                    return '<div class="md-container spoiler"><h3><i class="fa fa-eye-slash" aria-hidden="true"></i> ' + md.utils.escapeHtml(m[1]) + '</h3>\n<div class="spoilerContent">'; // returns the video preview

                } else {
                    // closing tag
                    return '</div></div>\n';
                }
            }
        });
    }

    if (settings.url){
        md.use(require('markdown-it-container'), 'url', {

            validate: function(params) {
                return params.trim().match(/^url\s+(.*)$/);
            },

            render: function(tokens, idx) {
                var m = tokens[idx].info.trim().match(/^url\s+(.*)$/);

                if (tokens[idx].nesting === 1) {
                    // opening tag
                    return '<div>'+ipcRenderer.sendSync('linkPreview', m[1]); // returns the linkPreview provided by the electron main process through ipc

                } else {
                    // closing tag
                    return '</div>\n';
                }
            }
        });
    }

    if (settings.youtube){
        md.use(require('markdown-it-container'), 'youtube', {

            validate: function(params) {
                return params.trim().match(/^youtube\s+(.*)$/);
            },

            render: function(tokens, idx) {
                var m = tokens[idx].info.trim().match(/^youtube\s+(.*)$/);

                if (tokens[idx].nesting === 1) {
                    // opening tag
                    return `<div class="youtubePreview"><iframe width="560" height="315" src="https://www.youtube.com/embed/${m[1]}" frameborder="0" allowfullscreen></iframe>`; // returns the video preview

                } else {
                    // closing tag
                    return '</div>\n';
                }
            }
        });
    }

    if (settings.graph){
        md.use(require('markdown-it-container'), 'graph', {

            validate: function(params) {
                return params.trim().match(/^graph\s+(.*)$/);
            },

            render: function(tokens, idx) {
                var m = tokens[idx].info.trim().match(/^graph\s+(.*)$/);

                if (tokens[idx].nesting === 1) {
                    // opening tag
                    try{
                        const node = mathjs.parse(m[1]);
                        const latex = node ? node.toTex({parenthesis: "keep", implicit: "hide"}) : '';
                        const renderedTex = katex.renderToString(latex, {throwOnError: false})
                        if (settings.isPreview){
                            return `<div class="plotContainer">${renderedTex}`
                        } else{
                            return `<div class="plotContainer">${renderedTex}<div id="plot${idx}"></div></div>

                            <script>
                              function draw() {
                                try {
                                  functionPlot({
                                    target: '#plot${idx}',
                                    data: [{
                                      fn: "${m[1]}",
                                      sampler: 'builtIn',  // this will make function-plot use the evaluator of math.js
                                      graphType: 'polyline'
                                    }]
                                  });
                                }
                                catch (err) {
                                  console.log(err);
                                }
                              }

                              draw();
                            </script>`; // returns the preview
                        }

                    }
                    catch(e){
                        return "PLOT"
                    }


                } else {
                    // closing tag
                    return '\n';
                }
            }
        });
    }

    if (settings.isPreview){
        // keep track of original line
        function injectLineNumbers(tokens, idx, options, env, slf) {
            var line;
            if (tokens[idx].map) {
                line = tokens[idx].map[0];
                // tokens[idx].attrJoin('class', 'line');
                tokens[idx].attrSet('data-line', String(line));
            }
            return slf.renderToken(tokens, idx, options, env, slf);
        }

        md.renderer.rules.paragraph_open =
            md.renderer.rules.heading_open =
            md.renderer.rules.paragraph_open =
            md.renderer.rules.blockquote_open =
            md.renderer.rules.ordered_list_open =
            md.renderer.rules.bullet_list_open =
            md.renderer.rules.list_item_open =
            md.renderer.rules.table_open =
            md.renderer.rules.tr_open =
            injectLineNumbers;
    }

    // load local files when used as src for an image
    function loadFileSrcImage(tokens, idx, options, env, slf) {
        const src = tokens[idx].attrs.filter(x => x[0]==="src")[0][1]

        if (fs.existsSync(path.join(workingDir, src))) { // relative path
            const mimeLookup = mime.lookup(path.join(workingDir, src))
            if (mimeLookup.startsWith("image")){
                tokens[idx].attrSet("src", "data:" + mimeLookup + ";base64," + fs.readFileSync(path.join(workingDir, src)).toString("base64"))
            }
        }else if (fs.existsSync(src)){ // absolute path
            const mimeLookup = mime.lookup(src)
            if (mimeLookup.startsWith("image")){
                tokens[idx].attrSet("src", "data:" + mimeLookup + ";base64," + fs.readFileSync(src).toString("base64"))
            }
        }

        return slf.renderToken(tokens, idx, options, env, slf);
    }

    md.renderer.rules.image = loadFileSrcImage;

    return md
}
export default newMd
