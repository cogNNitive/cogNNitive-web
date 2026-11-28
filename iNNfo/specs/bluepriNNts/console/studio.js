/* global module: writable */
/* global echarts */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./ui-kit.js'))
  } else {
    root.nnStudio = factory(root.nnUI)
  }
})(typeof self !== 'undefined' ? self : this, function (UI) {
  'use strict'

  if (!UI) throw new Error('nnUI missing: load ui-kit.js first')

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function el(tag, cls, text) {
    var node = typeof document !== 'undefined' ? document.createElement(tag) : null
    if (!node) return null
    if (cls) node.className = cls
    if (text != null) node.textContent = String(text)
    return node
  }

  function domainModelVersion(meta) {
    var models = Array.isArray(meta && meta.models) ? meta.models : []
    return models.length === 1 && models[0] ? String(models[0].version || '') : ''
  }

  function isPureSeriesValue(value) {
    return value === null || (typeof value === 'number' && Number.isFinite(value))
  }

  function compileChartSeries(series, meta) {
    var source = isObject(series) ? series : {}
    var chartsMeta = Array.isArray(meta && meta.charts) ? meta.charts : []
    var charts = []
    var missing = []
    var invalid = []
    chartsMeta.forEach(function (c) {
      var id = c && c.id
      var label = String((c && c.label) || id || '')
      var raw = source[id]
      if (raw === undefined || raw === null) {
        missing.push({ id: id, label: label })
        return
      }
      var variants = []
      if (Array.isArray(raw)) {
        variants.push({ label: label, values: raw })
      } else if (isObject(raw)) {
        var keys = Object.keys(raw)
        if (keys.length === 0) {
          missing.push({ id: id, label: label })
          return
        }
        for (var k = 0; k < keys.length; k++) {
          var vLabel = String(keys[k])
          var v = raw[keys[k]]
          if (!Array.isArray(v)) {
            invalid.push({
              id: id,
              label: label,
              detail: 'variant "' + vLabel + '" is not an array',
            })
            return
          }
          variants.push({ label: vLabel, values: v })
        }
      } else {
        invalid.push({ id: id, label: label, detail: 'series must be an array or a variants map' })
        return
      }
      for (var vi = 0; vi < variants.length; vi++) {
        var values = variants[vi].values
        for (var i = 0; i < values.length; i++) {
          if (!isPureSeriesValue(values[i])) {
            invalid.push({
              id: id,
              label: label,
              detail:
                'non-pure series value at index ' + i + ' in variant "' + variants[vi].label + '"',
            })
            return
          }
        }
      }
      var n = Math.max.apply(
        null,
        variants.map(function (v) {
          return v.values.length
        }),
      )
      var xs = []
      for (var xi = 0; xi < (Number.isFinite(n) ? n : 0); xi++) xs.push(xi)
      charts.push({
        id: id,
        label: label,
        xs: xs,
        variants: variants,
        count: Number.isFinite(n) ? n : 0,
      })
    })
    return {
      ok: missing.length === 0 && invalid.length === 0,
      charts: charts,
      missing: missing,
      invalid: invalid,
    }
  }

  function monthAxis(meta, count) {
    var startMonth = Number(meta && meta.startMonth) || 1
    var fallbackYear = typeof Date !== 'undefined' ? new Date().getFullYear() : 2026
    var startYear = Number(meta && meta.startYear) || fallbackYear
    var n = Math.max(0, Number(count) || 0)
    var labels = []
    for (var i = 0; i < n; i++) {
      var m = ((startMonth - 1 + i) % 12) + 1
      var y = startYear + Math.floor((startMonth - 1 + i) / 12)
      labels.push(String(y) + '-' + pad2(m))
    }
    return labels
  }

  // ---- Charts (ECharts) ----------------------------------------------------
  // The one chart entry point for built-in tabs and custom views: it takes a plain
  // ECharts option and applies the console defaults (white background, palette).
  var CHART_PALETTE = [
    '#2563eb',
    '#dc2626',
    '#16a34a',
    '#f59e0b',
    '#7c3aed',
    '#0891b2',
    '#db2777',
    '#65a30d',
  ]

  function chartLibrary() {
    if (typeof Chart !== 'undefined') return Chart
    if (typeof self !== 'undefined' && self.Chart) return self.Chart
    if (typeof echarts !== 'undefined') return echarts
    return (typeof self !== 'undefined' && self.echarts) || null
  }

  function warnChartLibraryMissing() {
    if (typeof console !== 'undefined' && console.warn)
      console.warn(
        'nn-console: Chart library unavailable — charts need the vendored console bundle',
      )
  }

  function flattenTreemapData(tree) {
    var result = []
    function walk(nodes, parentNames, parentColor) {
      if (!Array.isArray(nodes)) return
      nodes.forEach(function (n) {
        if (!n) return
        var color = (n.itemStyle && n.itemStyle.color) || parentColor
        var levels = parentNames.concat([n.name || ''])
        if (Array.isArray(n.children) && n.children.length > 0) {
          walk(n.children, levels, color)
        } else {
          result.push({
            l0: levels[0] || 'Domain',
            l1: levels[1] || n.name || '',
            l2: levels[2] || n.name || '',
            name: n.name || '',
            value: Number(n.value) || 1,
            elementId: n.elementId || '',
            color: color || CHART_PALETTE[0],
          })
        }
      })
    }
    walk(tree, [], null)
    return result
  }

  function toChartJsConfig(option, o) {
    if (!option) return { type: 'line', data: { labels: [], datasets: [] } }
    if (option.type && (option.data || option.options)) return option

    var series = option.series || []
    var firstSeries = series[0] || {}
    var sType = firstSeries.type || 'line'

    if (sType === 'treemap') {
      var rawTree = firstSeries.data || []
      var hasNested =
        Array.isArray(rawTree) &&
        rawTree.some(function (d) {
          return d && Array.isArray(d.children) && d.children.length > 0
        })
      var flat = hasNested ? flattenTreemapData(rawTree) : rawTree
      var groups = firstSeries.groups || (hasNested ? ['l0', 'l1'] : ['name'])
      return {
        type: 'treemap',
        data: {
          datasets: [
            {
              tree: flat,
              key: 'value',
              groups: groups,
              backgroundColor: function (ctx) {
                if (ctx.type !== 'data') return 'transparent'
                var d = ctx.raw && (ctx.raw._data || ctx.raw)
                return (d && (d.color || (d.itemStyle && d.itemStyle.color))) || CHART_PALETTE[0]
              },
              borderColor: '#ffffff',
              borderWidth: 2,
              spacing: 1,
              labels: {
                display: true,
                formatter: function (ctx) {
                  var d = ctx.raw && (ctx.raw._data || ctx.raw)
                  return ctx.raw.g || (d && (d.name || d.label)) || ''
                },
                color: '#ffffff',
                font: { size: 11, weight: 'bold' },
              },
            },
          ],
        },
        options: {
          animation: false,
          responsive: false,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
        },
      }
    }

    var xData = (option.xAxis && option.xAxis.data) || []
    var datasets = series.map(function (s, i) {
      var color =
        (s.itemStyle && s.itemStyle.color) ||
        (s.lineStyle && s.lineStyle.color) ||
        CHART_PALETTE[i % CHART_PALETTE.length]
      return {
        label: s.name || 'Series ' + (i + 1),
        data: s.data || [],
        borderColor: color,
        backgroundColor: color,
        borderWidth: (s.lineStyle && s.lineStyle.width) || 2,
        pointRadius: s.showSymbol ? 3 : 0,
        spanGaps: s.connectNulls || false,
      }
    })

    return {
      type: sType === 'bar' ? 'bar' : 'line',
      data: {
        labels: xData,
        datasets: datasets,
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: option.legend && option.legend.show !== false,
            position: 'top',
          },
          tooltip: {
            mode: option.tooltip && option.tooltip.trigger === 'axis' ? 'index' : 'nearest',
            intersect: !(option.tooltip && option.tooltip.trigger === 'axis'),
          },
        },
        scales: {
          x: {
            display: !(option.xAxis && option.xAxis.show === false),
            grid: { display: false },
          },
          y: {
            display: !(option.yAxis && option.yAxis.show === false),
            beginAtZero: false,
          },
        },
      },
    }
  }

  function renderSvgGraph(host, option, opts) {
    var o = opts || {}
    var seriesList = (option && option.series) || []
    var graph =
      seriesList.find(function (s) {
        return s.type === 'graph'
      }) ||
      seriesList[0] ||
      {}
    var linesSeries = seriesList.find(function (s) {
      return s.type === 'lines'
    })
    var scatterSeries = seriesList.filter(function (s) {
      return s.type === 'scatter'
    })

    var doc = host.ownerDocument || document
    host.innerHTML = ''

    var autoW = o.width === undefined
    var autoH = o.height === undefined
    var width = autoW ? graph.width || host.clientWidth || 960 : o.width
    var height = autoH ? graph.height || host.clientHeight || 450 : o.height
    if (typeof width === 'string') width = parseInt(width, 10) || 960
    if (typeof height === 'string') height = parseInt(height, 10) || 450
    if (height < 200) height = 200

    var isCircular = graph.layout === 'circular'
    var rawNodes = graph.data || []

    var xAxis = option.xAxis || {}
    var yAxis = option.yAxis || {}
    var hasCartesian =
      xAxis.min !== undefined &&
      xAxis.max !== undefined &&
      yAxis.min !== undefined &&
      yAxis.max !== undefined
    var xMin = Number(xAxis.min) || 0
    var xMax = Number(xAxis.max) || 1
    var yMin = Number(yAxis.min) || 0
    var yMax = Number(yAxis.max) || 1

    function posOf(val, defX, defY) {
      if (hasCartesian && Array.isArray(val)) {
        var rx = (val[0] - xMin) / (xMax - xMin)
        var ry = (val[1] - yMin) / (yMax - yMin)
        return { x: rx * width, y: ry * height }
      }
      return {
        x: defX !== undefined ? defX : Array.isArray(val) ? val[0] : 0,
        y: defY !== undefined ? defY : Array.isArray(val) ? val[1] : 0,
      }
    }

    var nodePos = {}
    if (isCircular) {
      var cx = width / 2
      var cy = height / 2
      var centerNode =
        rawNodes.find(function (n) {
          return n.symbolSize > 30
        }) || rawNodes[0]
      var centerId = centerNode ? centerNode.id || centerNode.name : null
      var otherNodes = rawNodes.filter(function (n) {
        return (n.id || n.name) !== centerId
      })
      var R = Math.max(60, Math.min(width, height) / 2 - 50)
      if (centerId) nodePos[centerId] = { x: cx, y: cy, isCenter: true }
      otherNodes.forEach(function (n, idx) {
        var id = n.id || n.name
        var angle = (2 * Math.PI * idx) / (otherNodes.length || 1) - Math.PI / 2
        nodePos[id] = {
          x: cx + R * Math.cos(angle),
          y: cy + R * Math.sin(angle),
          isCenter: false,
        }
      })
    } else {
      rawNodes.forEach(function (n) {
        var id = n.id || n.name
        nodePos[id] = posOf(n.value, n.x, n.y)
      })
    }

    var svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
    svg.setAttribute('class', 'nn-svg-graph')
    svg.style.display = 'block'
    svg.style.width = '100%'
    svg.style.height = '100%'
    svg.style.overflow = 'visible'

    var defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs')
    defs.innerHTML =
      '<marker id="nn-graph-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />' +
      '</marker>' +
      '<marker id="nn-graph-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M 0 1 L 10 5 L 0 9 z" fill="#2563eb" />' +
      '</marker>'
    svg.appendChild(defs)

    var linksG = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    linksG.setAttribute('class', 'nn-graph-links')

    if (linesSeries && Array.isArray(linesSeries.data)) {
      linesSeries.data.forEach(function (stroke) {
        var p1 = posOf(stroke.coords[0])
        var p2 = posOf(stroke.coords[1])
        var path = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', 'M ' + p1.x + ' ' + p1.y + ' L ' + p2.x + ' ' + p2.y)
        var st = stroke.lineStyle || {}
        path.setAttribute('stroke', st.color || '#64748b')
        path.setAttribute('stroke-width', String(st.width || 1))
        if (st.type === 'dashed') path.setAttribute('stroke-dasharray', '5,5')
        if (st.opacity) path.setAttribute('opacity', String(st.opacity))
        path.setAttribute('marker-end', 'url(#nn-graph-arrow)')
        path.setAttribute('fill', 'none')
        linksG.appendChild(path)
      })
    }

    var links = graph.links || []
    links.forEach(function (link) {
      var sPos = nodePos[link.source]
      var tPos = nodePos[link.target]
      if (!sPos || !tPos) return

      if (!linesSeries) {
        var path = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
        var st = link.lineStyle || {}
        var isDashed = st.type === 'dashed'
        var curveness = st.curveness || 0
        var d = ''
        if (curveness) {
          var mx = (sPos.x + tPos.x) / 2 - (tPos.y - sPos.y) * curveness
          var my = (sPos.y + tPos.y) / 2 + (tPos.x - sPos.x) * curveness
          d = 'M ' + sPos.x + ' ' + sPos.y + ' Q ' + mx + ' ' + my + ' ' + tPos.x + ' ' + tPos.y
        } else {
          d = 'M ' + sPos.x + ' ' + sPos.y + ' L ' + tPos.x + ' ' + tPos.y
        }
        path.setAttribute('d', d)
        path.setAttribute('stroke', st.color || '#94a3b8')
        path.setAttribute('stroke-width', String(st.width || 1.5))
        if (isDashed) path.setAttribute('stroke-dasharray', '5,5')
        path.setAttribute('fill', 'none')
        path.setAttribute('marker-end', 'url(#nn-graph-arrow)')
        linksG.appendChild(path)
      }

      var lbl = link.label
      var labelText = (lbl && (lbl.formatter || lbl.text)) || ''
      if (labelText && lbl.show !== false) {
        var lmx = (sPos.x + tPos.x) / 2
        var lmy = (sPos.y + tPos.y) / 2
        var gLabel = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
        var textEl = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
        textEl.setAttribute('x', String(lmx))
        textEl.setAttribute('y', String(lmy + 3))
        textEl.setAttribute('font-size', '10')
        textEl.setAttribute('font-weight', '500')
        textEl.setAttribute('text-anchor', 'middle')
        textEl.setAttribute('fill', lbl.color || '#475569')
        textEl.textContent = labelText

        var textLen = labelText.length * 6 + 12
        var bg = doc.createElementNS('http://www.w3.org/2000/svg', 'rect')
        bg.setAttribute('x', String(lmx - textLen / 2))
        bg.setAttribute('y', String(lmy - 8))
        bg.setAttribute('width', String(textLen))
        bg.setAttribute('height', '16')
        bg.setAttribute('rx', '4')
        bg.setAttribute('fill', lbl.backgroundColor || '#ffffff')
        bg.setAttribute('stroke', '#cbd5e1')
        bg.setAttribute('stroke-width', '1')
        gLabel.appendChild(bg)
        gLabel.appendChild(textEl)
        linksG.appendChild(gLabel)
      }
    })
    svg.appendChild(linksG)

    var nodesG = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    nodesG.setAttribute('class', 'nn-graph-nodes')

    var chartInstance = {
      _isDisposed: false,
      handlers: {},
      on: function (event, handler) {
        this.handlers[event] = handler
      },
      getOption: function () {
        return option
      },
      setOption: function (newOpt) {
        if (newOpt) option = newOpt
        // A rebuild makes a new instance and new DOM listeners: the handlers registered on
        // the old one would be lost, which is how the flow graph kept redrawing itself dead
        // to clicks after every focus or resize.
        var carried = this.handlers
        var next = renderSvgGraph(host, option, o)
        if (next) next.handlers = carried
      },
      resize: function () {},
      dispose: function () {
        this._isDisposed = true
        host.innerHTML = ''
        if (host.__chartInstance === this) host.__chartInstance = null
      },
      destroy: function () {
        this.dispose()
      },
      isDisposed: function () {
        return this._isDisposed
      },
      getWidth: function () {
        return width
      },
      getHeight: function () {
        return height
      },
    }

    rawNodes.forEach(function (node) {
      if (node.name && node.name.startsWith('__nn-schema-anchor-')) return
      var id = node.id || node.name
      var p = nodePos[id]
      if (!p) return

      var g = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
      g.setAttribute('class', 'nn-node-g')
      g.setAttribute('data-id', id)
      g.setAttribute('data-name', node.name || id)
      g.style.cursor = 'pointer'

      var isRect = !isCircular && (node.symbol === 'rect' || Array.isArray(node.symbolSize))
      var st = node.itemStyle || {}
      var borderColor = st.borderColor || '#3b82f6'
      var fill = st.color || '#ffffff'
      var borderWidth = st.borderWidth !== undefined ? st.borderWidth : 1

      if (isRect) {
        var w = Array.isArray(node.symbolSize) ? node.symbolSize[0] : node.symbolSize || 120
        var h = Array.isArray(node.symbolSize) ? node.symbolSize[1] : 40
        var x = p.x - w / 2
        var y = p.y - h / 2

        var rect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect')
        rect.setAttribute('x', String(x))
        rect.setAttribute('y', String(y))
        rect.setAttribute('width', String(w))
        rect.setAttribute('height', String(h))
        rect.setAttribute('rx', '6')
        rect.setAttribute('fill', fill)
        rect.setAttribute('stroke', borderColor)
        rect.setAttribute('stroke-width', String(borderWidth))
        if (st.borderType === 'dashed') rect.setAttribute('stroke-dasharray', '5,5')
        if (st.borderType === 'dotted') rect.setAttribute('stroke-dasharray', '2,2')
        if (st.opacity) rect.setAttribute('opacity', String(st.opacity))
        g.appendChild(rect)

        var lbl = node.label || {}
        var formatter = lbl.formatter || node.name || ''

        if (typeof formatter === 'string' && formatter.indexOf('{t|') !== -1) {
          var matchT = formatter.match(/\{t\|([^}]+)\}/)
          var headerText = matchT ? matchT[1] : node.name
          var headerBand = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
          headerBand.setAttribute(
            'd',
            'M ' +
              x +
              ' ' +
              (y + 6) +
              ' Q ' +
              x +
              ' ' +
              y +
              ' ' +
              (x + 6) +
              ' ' +
              y +
              ' L ' +
              (x + w - 6) +
              ' ' +
              y +
              ' Q ' +
              (x + w) +
              ' ' +
              y +
              ' ' +
              (x + w) +
              ' ' +
              (y + 6) +
              ' L ' +
              (x + w) +
              ' ' +
              (y + 26) +
              ' L ' +
              x +
              ' ' +
              (y + 26) +
              ' Z',
          )
          headerBand.setAttribute('fill', borderColor)
          g.appendChild(headerBand)

          var tHeader = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
          tHeader.setAttribute('x', String(x + 8))
          tHeader.setAttribute('y', String(y + 17))
          tHeader.setAttribute('font-size', '12')
          tHeader.setAttribute('font-weight', '600')
          tHeader.setAttribute('fill', '#ffffff')
          tHeader.textContent = headerText
          g.appendChild(tHeader)

          var lines = formatter.split('\n').slice(1)
          var tFields = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
          tFields.setAttribute('x', String(x + 8))
          tFields.setAttribute('y', String(y + 42))
          tFields.setAttribute('font-size', '11')
          tFields.setAttribute('fill', '#374151')
          lines.forEach(function (line, li) {
            var clean = line.replace(/\{[a-z]\|([^}]+)\}/g, '$1')
            var tspan = doc.createElementNS('http://www.w3.org/2000/svg', 'tspan')
            tspan.setAttribute('x', String(x + 8))
            tspan.setAttribute('dy', li === 0 ? '0' : '16')
            tspan.textContent = clean
            tFields.appendChild(tspan)
          })
          g.appendChild(tFields)
        } else if (typeof formatter === 'string' && formatter.indexOf('{title|') !== -1) {
          var titles = []
          var subText = ''
          formatter.split('\n').forEach(function (line) {
            var mT = line.match(/\{title\|([^}]+)\}/)
            var mS = line.match(/\{sub\|([^}]+)\}/)
            if (mT) titles.push(mT[1])
            if (mS) subText = mS[1]
          })
          var textG = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
          textG.setAttribute('x', String(x + 8))
          textG.setAttribute('y', String(y + 18))
          textG.setAttribute('font-size', '12')
          textG.setAttribute('font-weight', '600')
          textG.setAttribute('fill', '#111827')
          titles.forEach(function (t, ti) {
            var tspan = doc.createElementNS('http://www.w3.org/2000/svg', 'tspan')
            tspan.setAttribute('x', String(x + 8))
            tspan.setAttribute('dy', ti === 0 ? '0' : '15')
            tspan.textContent = t
            textG.appendChild(tspan)
          })
          if (subText) {
            var tspanSub = doc.createElementNS('http://www.w3.org/2000/svg', 'tspan')
            tspanSub.setAttribute('x', String(x + 8))
            tspanSub.setAttribute('dy', '15')
            tspanSub.setAttribute('font-size', '10')
            tspanSub.setAttribute('font-weight', '400')
            tspanSub.setAttribute('fill', '#6b7280')
            tspanSub.textContent = subText
            textG.appendChild(tspanSub)
          }
          g.appendChild(textG)
        } else {
          var textEl = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
          textEl.setAttribute('x', String(x + 8))
          textEl.setAttribute('y', String(y + h / 2 + 4))
          textEl.setAttribute('font-size', '12')
          textEl.setAttribute('fill', '#1f2937')
          textEl.textContent = formatter || node.name || id
          g.appendChild(textEl)
        }
      } else {
        var r = p.isCenter ? 24 : 15
        var circle = doc.createElementNS('http://www.w3.org/2000/svg', 'circle')
        circle.setAttribute('cx', String(p.x))
        circle.setAttribute('cy', String(p.y))
        circle.setAttribute('r', String(r))
        circle.setAttribute('fill', fill)
        circle.setAttribute('stroke', borderColor)
        circle.setAttribute('stroke-width', String(borderWidth || (p.isCenter ? 3 : 1)))
        g.appendChild(circle)

        var labelText = node.name || id
        var textNode = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
        textNode.setAttribute('x', String(p.x))
        textNode.setAttribute('y', String(p.y + r + 14))
        textNode.setAttribute('font-size', '11')
        textNode.setAttribute('font-weight', p.isCenter ? '600' : '400')
        textNode.setAttribute('text-anchor', 'middle')
        textNode.setAttribute('fill', '#1f2937')
        textNode.textContent = labelText
        g.appendChild(textNode)
      }

      if (node.tooltipText || node.name || id) {
        var titleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'title')
        titleEl.textContent = (node.tooltipText || node.name || id).replace(/<br\s*\/?>/g, ' ')
        g.appendChild(titleEl)
      }

      if (node.selected || node.focused) {
        g.setAttribute('data-selected', 'true')
        var halo = doc.createElementNS('http://www.w3.org/2000/svg', 'rect')
        halo.setAttribute('x', String(x - 4))
        halo.setAttribute('y', String(y - 4))
        halo.setAttribute('width', String(w + 8))
        halo.setAttribute('height', String(h + 8))
        halo.setAttribute('rx', '8')
        halo.setAttribute('fill', 'none')
        halo.setAttribute('stroke', '#2563eb')
        halo.setAttribute('stroke-width', '2.5')
        halo.style.pointerEvents = 'none'
        g.appendChild(halo)
      }

      g.setAttribute('data-node-id', String(id))

      nodesG.appendChild(g)
    })
    svg.appendChild(nodesG)

    // One listener on the root, not one per node. A redraw rebuilds every group, and a
    // listener bound to a group dies with it; delegating keeps the graph clickable across
    // rebuilds and needs nothing from the node that was drawn.
    svg.addEventListener('click', function (ev) {
      var el = ev && ev.target
      var group = el && el.closest ? el.closest('g[data-node-id]') : null
      if (!group) return
      var nodeId = group.getAttribute('data-node-id')
      var handler = chartInstance.handlers && chartInstance.handlers.click
      if (!handler) return
      var item = null
      for (var i = 0; i < rawNodes.length; i++) {
        if (String(rawNodes[i].id || rawNodes[i].name) === nodeId) {
          item = rawNodes[i]
          break
        }
      }
      handler({
        dataType: 'node',
        data: item || { id: nodeId },
        name: item ? item.name || nodeId : nodeId,
        id: nodeId,
      })
    })

    scatterSeries.forEach(function (sc) {
      if (!Array.isArray(sc.data)) return
      sc.data.forEach(function (item) {
        var p = posOf(item.value)
        var isHeadBadge = (sc.label && sc.label.formatter === 'HEAD') || item.id === 'head'

        if (isHeadBadge) {
          var gHead = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
          gHead.setAttribute('class', 'nn-graph-head-badge')
          gHead.style.pointerEvents = 'none'

          var sw = sc.symbolSize ? sc.symbolSize[0] : 38
          var sh = sc.symbolSize ? sc.symbolSize[1] : 13
          var offY = sc.symbolOffset ? sc.symbolOffset[1] : -22
          var hx = p.x - sw / 2
          var hy = p.y + offY - sh / 2
          var hrect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect')
          hrect.setAttribute('x', String(hx))
          hrect.setAttribute('y', String(hy))
          hrect.setAttribute('width', String(sw))
          hrect.setAttribute('height', String(sh))
          hrect.setAttribute('rx', '3')
          hrect.setAttribute('fill', (sc.itemStyle && sc.itemStyle.color) || '#2563eb')
          gHead.appendChild(hrect)

          var txt = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
          txt.setAttribute('x', String(p.x))
          txt.setAttribute('y', String(hy + 9.5))
          txt.setAttribute('font-size', '8')
          txt.setAttribute('font-weight', '700')
          txt.setAttribute('text-anchor', 'middle')
          txt.setAttribute('fill', '#ffffff')
          txt.textContent = 'HEAD'
          gHead.appendChild(txt)
          svg.appendChild(gHead)
        } else {
          var gFocus = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
          gFocus.setAttribute('class', 'nn-graph-focus-ring')
          gFocus.style.pointerEvents = 'none'

          var fw = sc.symbolSize ? sc.symbolSize[0] : 150
          var fh = sc.symbolSize ? sc.symbolSize[1] : 50
          var fx = p.x - fw / 2
          var fy = p.y - fh / 2
          var frect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect')
          frect.setAttribute('x', String(fx))
          frect.setAttribute('y', String(fy))
          frect.setAttribute('width', String(fw))
          frect.setAttribute('height', String(fh))
          frect.setAttribute('rx', '8')
          frect.setAttribute('fill', 'none')
          frect.setAttribute('stroke', (sc.itemStyle && sc.itemStyle.borderColor) || '#2563eb')
          frect.setAttribute(
            'stroke-width',
            String((sc.itemStyle && sc.itemStyle.borderWidth) || 2.5),
          )
          gFocus.appendChild(frect)
          svg.appendChild(gFocus)
        }
      })
    })

    host.appendChild(svg)
    host.__chartInstance = chartInstance
    if (typeof window !== 'undefined') {
      window.echarts = window.echarts || {}
      window.echarts.getInstanceByDom = function (h) {
        if (!h) return null
        var c = h.tagName === 'CANVAS' ? h : h.querySelector('canvas')
        return (c && c.__chartInstance) || h.__chartInstance || null
      }
    }
    return chartInstance
  }

  function renderChart(host, option, opts) {
    if (!host) return null
    var o = opts || {}
    var seriesList = (option && option.series) || []
    var firstSeries = seriesList[0] || {}
    var sType = firstSeries.type || 'line'

    var lib = chartLibrary()
    if (!lib) {
      warnChartLibraryMissing()
      return null
    }

    if (
      sType === 'graph' ||
      seriesList.some(function (s) {
        return s.type === 'graph'
      })
    ) {
      return renderSvgGraph(host, option, o)
    }
    var o = opts || {}

    // Support Chart.js natively
    if (lib.register || lib.registry) {
      var canvas = host.tagName === 'CANVAS' ? host : host.querySelector('canvas')
      if (!canvas) {
        canvas = (host.ownerDocument || document).createElement('canvas')
        host.innerHTML = ''
        host.appendChild(canvas)
      }
      var autoWidth = o.width === undefined
      var autoHeight = o.height === undefined
      canvas.width = autoWidth ? host.clientWidth || 960 : o.width
      canvas.height = autoHeight ? host.clientHeight || 400 : o.height
      if (o.height) canvas.style.height = typeof o.height === 'number' ? o.height + 'px' : o.height
      if (o.width) canvas.style.width = typeof o.width === 'number' ? o.width + 'px' : o.width

      var prev = lib.getChart ? lib.getChart(canvas) : canvas.__chartInstance || null
      if (prev && typeof prev.destroy === 'function') prev.destroy()
      if (host.__nnChartObserver) {
        host.__nnChartObserver.disconnect()
        host.__nnChartObserver = null
      }

      var chartConfig = toChartJsConfig(option, o)
      var chart = new lib(canvas, chartConfig)
      canvas.__chartInstance = chart
      host.__chartInstance = chart
      if (!lib.getInstanceByDom) {
        lib.getInstanceByDom = function (el) {
          if (!el) return null
          var c = el.tagName === 'CANVAS' ? el : el.querySelector('canvas')
          return (c && c.__chartInstance) || el.__chartInstance || null
        }
      }
      if (typeof window !== 'undefined') {
        window.echarts = window.echarts || {
          getInstanceByDom: function (h) {
            return lib.getInstanceByDom(h)
          },
        }
      }
      chart._isDisposed = false
      chart.getWidth = function () {
        return canvas.width
      }
      chart.getHeight = function () {
        return canvas.height
      }
      chart.isDisposed = function () {
        return chart._isDisposed || !canvas.__chartInstance
      }
      var origDestroy = chart.destroy.bind(chart)
      chart.destroy = function () {
        chart._isDisposed = true
        if (canvas.__chartInstance === chart) canvas.__chartInstance = null
        if (host.__chartInstance === chart) host.__chartInstance = null
        return origDestroy()
      }
      chart.dispose = chart.destroy
      if (!lib.prototype.getOption) {
        lib.prototype.getOption = function () {
          var c = this
          return {
            backgroundColor:
              (c.canvas && c.canvas.style && c.canvas.style.backgroundColor) || '#ffffff',
            xAxis: [{ data: (c.data && c.data.labels) || [] }],
            series: ((c.data && c.data.datasets) || []).map(function (ds) {
              return {
                type: (c.config && c.config.type) || 'line',
                name: ds.label,
                data: ds.tree || ds.data || [],
              }
            }),
          }
        }
      }
      chart.on = function (event, handler) {
        if (event !== 'click') return
        canvas.addEventListener('click', function (e) {
          var meta = chart.getDatasetMeta && chart.getDatasetMeta(0)
          var els = (meta && meta.data) || []
          var isTreemap = !!(chart.config && chart.config.type === 'treemap')
          // The treemap plugin throws inside Chart.js hit-testing ("nearest" walks a null
          // canvas), which swallows the click; the cells carry their own geometry, so the hit
          // is resolved here instead and the deepest containing cell wins.
          if (isTreemap && els.length) {
            var box = canvas.getBoundingClientRect()
            var px = e.clientX - box.left
            var py = e.clientY - box.top
            var found = null
            for (var i = 0; i < els.length; i++) {
              var cell = els[i]
              if (!cell || typeof cell.x !== 'number' || typeof cell.width !== 'number') continue
              if (px < cell.x || px > cell.x + cell.width) continue
              if (py < cell.y || py > cell.y + cell.height) continue
              if (!found || cell.width * cell.height < found.width * found.height) found = cell
            }
            if (!found) return
            var rawCell = found.$context ? found.$context.raw : null
            if (rawCell && rawCell._data) rawCell = rawCell._data
            handler({ data: rawCell, raw: rawCell, seriesName: null })
            return
          }
          var activeEls = chart.getElementsAtEventForMode
            ? chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false)
            : []
          if (activeEls && activeEls.length) {
            var first = activeEls[0]
            var ds = chart.data.datasets[first.datasetIndex]
            var elem =
              first.element ||
              (chart.getDatasetMeta &&
                chart.getDatasetMeta(first.datasetIndex) &&
                chart.getDatasetMeta(first.datasetIndex).data[first.index])
            var elemRaw = elem && elem.$context ? elem.$context.raw : null
            var raw =
              (elemRaw && elemRaw._data) ||
              elemRaw ||
              (ds && ds.data && ds.data[first.index] && ds.data[first.index]._data) ||
              (ds && ds.data && ds.data[first.index]) ||
              (ds && ds.tree && ds.tree[first.index])
            handler({ data: raw, raw: raw, seriesName: ds && ds.label })
          }
        })
      }
      chart.getOption = function () {
        return {
          backgroundColor: (canvas.style && canvas.style.backgroundColor) || '#ffffff',
          xAxis: [
            {
              data:
                (chart.data && chart.data.labels) ||
                (option && option.xAxis && option.xAxis.data) ||
                [],
            },
          ],
          series:
            option && option.series && option.series.length
              ? option.series
              : ((chart.data && chart.data.datasets) || []).map(function (ds) {
                  return {
                    type: chartConfig.type || 'line',
                    name: ds.label,
                    data: ds.tree || ds.data || [],
                  }
                }),
        }
      }

      if (typeof ResizeObserver !== 'undefined' && (autoWidth || autoHeight)) {
        host.__nnChartObserver = new ResizeObserver(function () {
          if (canvas.__chartInstance && host.clientWidth) {
            chart.resize()
          }
        })
        host.__nnChartObserver.observe(host)
      }
      return chart
    }

    var previous = lib.getInstanceByDom(host)
    if (previous) previous.dispose()
    if (host.__nnChartObserver) {
      host.__nnChartObserver.disconnect()
      host.__nnChartObserver = null
    }
    var autoW = o.width === undefined
    var autoH = o.height === undefined
    var echartsChart = lib.init(host, null, {
      renderer: o.renderer || 'svg',
      width: autoW ? (host.clientWidth ? undefined : 960) : o.width,
      height: autoH ? (host.clientHeight ? undefined : 400) : o.height,
    })
    var merged = {}
    Object.keys(option || {}).forEach(function (key) {
      merged[key] = option[key]
    })
    if (merged.backgroundColor === undefined) merged.backgroundColor = '#ffffff'
    if (merged.color === undefined) merged.color = CHART_PALETTE
    echartsChart.setOption(merged)
    if (typeof ResizeObserver !== 'undefined' && (autoW || autoH)) {
      host.__nnChartObserver = new ResizeObserver(function () {
        if (!echartsChart.isDisposed() && host.clientWidth) {
          echartsChart.resize({
            width: autoW ? 'auto' : o.width,
            height: autoH ? 'auto' : o.height,
          })
        }
      })
      host.__nnChartObserver.observe(host)
    }
    return echartsChart
  }

  function renderCharts(host, model, meta) {
    if (!host) return
    var compiled = compileChartSeries(isObject(model) ? model.series : {}, meta)
    compiled.missing.forEach(function (c) {
      if (typeof console !== 'undefined' && console.warn)
        console.warn('nn-console: chart skipped — missing series for chart "' + c.id + '"')
    })
    compiled.invalid.forEach(function (c) {
      if (typeof console !== 'undefined' && console.warn)
        console.warn('nn-console: chart skipped — ' + c.label + ' (' + c.detail + ')')
    })
    if (!chartLibrary()) {
      warnChartLibraryMissing()
      return
    }
    var windowCount = (Number(meta && meta.months) || 0) + (Number(meta && meta.historyMonths) || 0)
    compiled.charts.forEach(function (chart) {
      var section = el('section', 'nn-chart')
      if (!section) return
      var heading = el('h3', 'nn-chart-title', chart.label)
      if (heading) section.appendChild(heading)
      var canvas = el('div', 'nn-chart-canvas')
      if (canvas) section.appendChild(canvas)
      host.appendChild(section)
      var labels = monthAxis(meta, windowCount || chart.count)
      try {
        renderChart(
          canvas,
          {
            tooltip: { trigger: 'axis' },
            legend: { show: true, top: 0 },
            grid: { left: 48, right: 16, top: 32, bottom: 32 },
            xAxis: {
              type: 'category',
              data: chart.xs.map(function (x) {
                return labels[x] != null ? labels[x] : String(x)
              }),
            },
            yAxis: { type: 'value' },
            series: chart.variants.map(function (variant) {
              return {
                type: 'line',
                name: variant.label,
                data: variant.values,
                connectNulls: false,
                showSymbol: false,
                lineStyle: { width: 2 },
              }
            }),
          },
          { height: 240 },
        )
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn)
          console.warn('nn-console: chart render failed for "' + chart.id + '"', err)
      }
    })
  }

  function formatGridNumber(v) {
    if (v == null || isNaN(v)) return '-'
    var abs = Math.abs(v)
    if (abs >= 1000000) return (v / 1000000).toFixed(1) + 'M'
    if (abs >= 10000) return Math.round(v).toLocaleString()
    if (abs >= 100) return (Math.round(v * 10) / 10).toLocaleString()
    return (Math.round(v * 100) / 100).toString()
  }

  function normalizeKey(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  }

  var warnedUnresolvedOperands = {}
  function warnUnresolvedOperand(token, formula) {
    var key = formula + '::' + token
    if (warnedUnresolvedOperands[key]) return
    warnedUnresolvedOperands[key] = true
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[innfo] Timeline formula "' + formula + '": unresolved operand "' + token + '"')
    }
  }

  function baseValueOf(row) {
    return row.base != null
      ? Number(row.base)
      : row.metricValue != null
        ? Number(row.metricValue)
        : row.val != null
          ? Number(row.val)
          : 0
  }

  function growValue(base, growth, m) {
    var factor = Number(growth.factor) || 0
    if (growth.mode === 'compound' && factor) return base * Math.pow(1 + factor / 100, m)
    if (growth.mode === 'additive' && factor) return base + factor * m
    return base
  }

  function evaluateFormulaTree(row, m, rowMap, overrides, memo, growthState, historyCount) {
    var memoKey = row.id + '|' + m
    if (memo[memoKey] !== undefined) return memo[memoKey]
    if (memo[memoKey] === null) return 0
    memo[memoKey] = null

    var val = 0
    var isVar =
      row.variable ||
      (!row.formula && (row.base != null || row.metricValue != null || row.val != null))

    if (isVar) {
      var growth = growthState[row.id] || row.growth || { mode: 'fixed', factor: 0 }
      if (overrides[row.id] !== undefined) {
        if (typeof overrides[row.id] === 'number') {
          val = growValue(Number(overrides[row.id]) || 0, growth, m)
        } else if (overrides[row.id] && overrides[row.id][m] !== undefined) {
          val = Number(overrides[row.id][m]) || 0
        } else {
          val = growValue(baseValueOf(row), growth, m)
        }
      } else {
        val = growValue(baseValueOf(row), growth, m)
      }
    } else if (Array.isArray(row.history) && m < row.history.length && row.history[m] !== null) {
      val = Number(row.history[m]) || 0
    } else if (row.formula) {
      val = parseAndEvalFormula(
        String(row.formula).trim(),
        m,
        rowMap,
        overrides,
        memo,
        growthState,
        historyCount,
      )
      var gRow = growthState[row.id] || row.growth || { mode: 'fixed', factor: 0 }
      var factorRow = Number(gRow.factor) || 0
      if (gRow.mode === 'compound' && factorRow) {
        val = val * Math.pow(1 + factorRow / 100, m)
      } else if (gRow.mode === 'additive' && factorRow) {
        val = val + factorRow * m
      }
    } else if (row.base != null) {
      val = Number(row.base)
    } else if (row.metricValue != null) {
      val = Number(row.metricValue)
    }

    memo[memoKey] = val
    return val
  }

  function parseAndEvalFormula(formula, m, rowMap, overrides, memo, growthState, historyCount) {
    if (!formula || /^<.*>$/.test(formula)) return 0
    var cleaned = formula.replace(/\s+[xX]\s+/g, ' * ')
    var tokens = cleaned
      .split(/(\s*[+\-*/]\s*)/)
      .map(function (s) {
        return s.trim()
      })
      .filter(Boolean)
    if (!tokens.length) return 0

    function resolveOperand(token) {
      var num = Number(token)
      if (!isNaN(num)) return num
      var norm = normalizeKey(token)
      var targetRow = rowMap[norm]
      if (targetRow) {
        var operandVal = evaluateFormulaTree(
          targetRow,
          m,
          rowMap,
          overrides,
          memo,
          growthState,
          historyCount,
        )
        if (!targetRow.formula && String(targetRow.metricUnit || '').trim() === '%')
          operandVal = operandVal / 100
        return operandVal
      }
      warnUnresolvedOperand(token, formula)
      return NaN
    }

    var terms = []
    var ops = []
    var i = 0
    while (i < tokens.length) {
      var tok = tokens[i]
      if (tok === '+' || tok === '-') {
        ops.push(tok)
        i++
      } else {
        var currentVal = resolveOperand(tok)
        while (i + 1 < tokens.length && (tokens[i + 1] === '*' || tokens[i + 1] === '/')) {
          var op = tokens[i + 1]
          var nextOperand = resolveOperand(tokens[i + 2])
          if (op === '*') currentVal = currentVal * nextOperand
          else if (op === '/') currentVal = nextOperand !== 0 ? currentVal / nextOperand : 0
          i += 2
        }
        terms.push(currentVal)
        i++
      }
    }

    if (!terms.length) return 0
    var res = terms[0]
    for (var j = 0; j < ops.length; j++) {
      var term = terms[j + 1] == null ? 0 : terms[j + 1]
      if (ops[j] === '+') res += term
      else if (ops[j] === '-') res -= term
    }
    return res
  }

  function exportTimelineCsv(meta, rows, totalMonths, labels, rowValues) {
    var lines = []
    lines.push('# Timeline & P&L Projection Export')
    lines.push('# Model: ' + (meta.model || ''))
    lines.push('# Version: ' + domainModelVersion(meta))
    lines.push('# Generated: ' + (meta.generated_at || meta.generated || ''))
    lines.push('')
    var header = ['Group', 'Metric', 'Type', 'Unit', 'Growth Rule']
    for (var m = 0; m < totalMonths; m++) {
      header.push(labels[m] != null ? labels[m] : 'Month ' + (m + 1))
    }
    header.push('Total')
    lines.push(
      header
        .map(function (s) {
          return '"' + String(s).replace(/"/g, '""') + '"'
        })
        .join(','),
    )

    rows.forEach(function (r) {
      var g = r.growth || { mode: 'fixed', factor: 0 }
      var vals = rowValues[r.id] || []
      var sum = vals.reduce(function (a, b) {
        return a + b
      }, 0)
      var rowLine = [
        r.grp || '',
        r.label || r.id,
        r.metricType || '',
        r.metricUnit || '',
        g.mode + (g.factor ? ' (' + g.factor + ')' : ''),
      ]
      for (var i = 0; i < totalMonths; i++) {
        rowLine.push(
          vals[i] != null && Number.isFinite(vals[i]) ? Math.round(vals[i] * 100) / 100 : '',
        )
      }
      rowLine.push(Number.isFinite(sum) ? Math.round(sum * 100) / 100 : '')
      lines.push(
        rowLine
          .map(function (s) {
            return '"' + String(s).replace(/"/g, '""') + '"'
          })
          .join(','),
      )
    })

    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
      var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
      var url = URL.createObjectURL(blob)
      var a = document.createElement('a')
      a.href = url
      a.download = (meta.slug || 'timeline') + '_projection.csv'
      a.click()
      setTimeout(function () {
        URL.revokeObjectURL(url)
      }, 1000)
    }
  }

  function getSemanticBarColor(val, minVal, maxVal, row) {
    if (row && row.colors && row.colors.gradient) {
      var grad = row.colors.gradient
      if (val <= minVal && grad.low) return grad.low
      if (val >= maxVal && grad.high) return grad.high
      if (grad.mid) return grad.mid
    }
    if (row && row.colors && row.colors.base) {
      return row.colors.base
    }

    if (val < 0) {
      return '#ef4444'
    }

    var metricType = (row && (row.metricType || row.type)) || ''
    var isCost =
      metricType === 'cost' ||
      metricType === 'expense' ||
      /cost|churn|cpa|cac|expense|churn/i.test((row && (row.id || row.label)) || '')

    var effectiveMin = Math.min(0, minVal)
    var effectiveMax = Math.max(0.0001, maxVal)
    var range = effectiveMax - effectiveMin
    var ratio = range > 0 ? (val - effectiveMin) / range : 1
    ratio = Math.max(0, Math.min(1, ratio))

    if (isCost) {
      if (ratio < 0.35) return '#86efac'
      if (ratio < 0.7) return '#f59e0b'
      return '#ef4444'
    } else {
      if (ratio < 0.25) return '#cbd5e1'
      if (ratio < 0.55) return '#6ee7b7'
      if (ratio < 0.85) return '#10b981'
      return '#059669'
    }
  }

  function renderStudioView(
    host,
    model,
    meta,
    rows,
    totalMonths,
    labels,
    rowMap,
    overrides,
    growthState,
    historyCount,
    onStateChange,
  ) {
    var studioHost = host
    if (!studioHost) return

    function computeValues() {
      var memo = {}
      var computed = {}
      rows.forEach(function (r) {
        var arr = []
        for (var m = 0; m < totalMonths; m++) {
          arr.push(evaluateFormulaTree(r, m, rowMap, overrides, memo, growthState, historyCount))
        }
        computed[r.id] = arr
      })
      return computed
    }

    var rowValues = computeValues()
    studioHost.innerHTML = ''

    var studioWrap = el('div', 'nn-studio-layout')

    var kpisWrap = el('div', 'nn-studio-kpis')

    var revRow = rows.filter(function (r) {
      return /revenue|ingreso/i.test(r.metricType || r.id || r.label)
    })[0]
    var costRow = rows.filter(function (r) {
      return /expense|cost|gasto/i.test(r.metricType || r.id || r.label)
    })[0]
    var netRow =
      rows.filter(function (r) {
        return /result|net|ebit|beneficio/i.test(r.metricType || r.id || r.label)
      })[0] || rows[0]

    var kpiList = []
    if (netRow && rowValues[netRow.id]) {
      var netSum = rowValues[netRow.id].reduce(function (a, b) {
        return a + b
      }, 0)
      kpiList.push({
        label: 'Net Result (Year 1)',
        val: formatGridNumber(netSum),
        unit: netRow.metricUnit || 'USD',
        isHighlight: true,
      })
    }
    if (revRow && rowValues[revRow.id]) {
      var revSum = rowValues[revRow.id].reduce(function (a, b) {
        return a + b
      }, 0)
      kpiList.push({
        label: 'Total Revenue',
        val: formatGridNumber(revSum),
        unit: revRow.metricUnit || 'USD',
      })
    }
    if (costRow && rowValues[costRow.id]) {
      var costSum = rowValues[costRow.id].reduce(function (a, b) {
        return a + b
      }, 0)
      kpiList.push({
        label: 'Total Expenses',
        val: formatGridNumber(costSum),
        unit: costRow.metricUnit || 'USD',
      })
    }

    kpiList.forEach(function (kpi) {
      var card = el('div', 'nn-studio-kpi-card' + (kpi.isHighlight ? ' is-highlight' : ''))
      card.appendChild(el('div', 'nn-studio-kpi-label', kpi.label))
      var valRow = el('div', 'nn-studio-kpi-val-row')
      valRow.appendChild(el('span', 'nn-studio-kpi-val', kpi.val))
      if (kpi.unit) valRow.appendChild(el('span', 'nn-studio-kpi-unit', kpi.unit))
      card.appendChild(valRow)
      kpisWrap.appendChild(card)
    })
    studioWrap.appendChild(kpisWrap)

    var mainGrid = el('div', 'nn-studio-grid')

    var leftCol = el('div', 'nn-studio-panel nn-studio-controls')
    var leftHdr = el('div', 'nn-studio-panel-hdr')
    leftHdr.appendChild(el('h4', 'nn-studio-panel-title', 'Scenario Parameters & Sliders'))
    leftCol.appendChild(leftHdr)

    var varRows = rows.filter(function (r) {
      return (
        r.variable || (!r.formula && (r.metricValue != null || r.val != null || r.base != null))
      )
    })

    if (!varRows.length) {
      varRows = rows.slice(0, 4)
    }

    var sliderCardsWrap = el('div', 'nn-studio-sliders-wrap')

    varRows.forEach(function (r) {
      var baseVal =
        r.metricValue !== undefined
          ? Number(r.metricValue)
          : r.val !== undefined
            ? Number(r.val)
            : r.base !== undefined
              ? Number(r.base)
              : 0
      var currVal =
        overrides[r.id] !== undefined
          ? typeof overrides[r.id] === 'number'
            ? overrides[r.id]
            : overrides[r.id][0]
          : baseVal
      if (currVal === undefined || isNaN(currVal)) currVal = baseVal

      var minVal =
        baseVal > 0 ? Math.floor(baseVal * 0.2) : baseVal < 0 ? Math.floor(baseVal * 2.5) : 0
      var maxVal =
        baseVal > 0 ? Math.ceil(baseVal * 2.5) : baseVal < 0 ? Math.ceil(baseVal * 0.2) : 100
      if (minVal === maxVal) {
        minVal = 0
        maxVal = 100
      }
      var step = baseVal > 1000 ? 100 : baseVal > 100 ? 10 : baseVal > 10 ? 1 : 0.1

      var card = el('div', 'nn-slider-card')
      var cardTop = el('div', 'nn-slider-card-top')
      cardTop.appendChild(el('span', 'nn-slider-label', r.label || r.id))
      var numInput = el('input', 'nn-slider-num-input')
      numInput.setAttribute('type', 'number')
      numInput.value = String(currVal)
      cardTop.appendChild(numInput)
      card.appendChild(cardTop)

      var sliderRow = el('div', 'nn-slider-row')
      var slider = el('input', 'nn-slider-range')
      slider.setAttribute('type', 'range')
      slider.setAttribute('min', String(minVal))
      slider.setAttribute('max', String(maxVal))
      slider.setAttribute('step', String(step))
      slider.value = String(currVal)

      function handleValChange(newVal) {
        var num = Number(newVal)
        if (isNaN(num)) return
        slider.value = String(num)
        numInput.value = String(num)
        overrides[r.id] = num
        onStateChange()
      }

      slider.addEventListener('input', function (e) {
        handleValChange(e.target.value)
      })

      numInput.addEventListener('change', function (e) {
        handleValChange(e.target.value)
      })

      sliderRow.appendChild(slider)
      card.appendChild(sliderRow)
      sliderCardsWrap.appendChild(card)
    })
    leftCol.appendChild(sliderCardsWrap)
    mainGrid.appendChild(leftCol)

    var rightCol = el('div', 'nn-studio-panel nn-studio-chart-panel')
    var rightHdr = el('div', 'nn-studio-panel-hdr')
    rightHdr.appendChild(el('h4', 'nn-studio-panel-title', 'Live Projections & Curves'))
    rightCol.appendChild(rightHdr)

    var chartWrap = el('div', 'nn-studio-svg-chart-wrap')
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'nn-studio-svg-chart')
    svg.setAttribute('viewBox', '0 0 700 240')
    svg.setAttribute('preserveAspectRatio', 'none')

    var plotRows = [netRow, revRow, costRow].filter(Boolean)
    var allVals = []
    plotRows.forEach(function (pr) {
      if (rowValues[pr.id]) allVals = allVals.concat(rowValues[pr.id])
    })
    if (!allVals.length) allVals = [0]
    var minPlot = Math.min(0, Math.min.apply(null, allVals))
    var maxPlot = Math.max(1, Math.max.apply(null, allVals))
    var plotRange = maxPlot - minPlot || 1

    var colors = ['#2563eb', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6']

    var gridG = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    gridG.setAttribute('class', 'nn-svg-grid')
    for (var gl = 0; gl <= 4; gl++) {
      var gy = 20 + gl * 45
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', '0')
      line.setAttribute('x2', '700')
      line.setAttribute('y1', String(gy))
      line.setAttribute('y2', String(gy))
      line.setAttribute('stroke', '#f1f5f9')
      line.setAttribute('stroke-dasharray', '3 3')
      gridG.appendChild(line)
    }
    svg.appendChild(gridG)

    if (minPlot < 0 && maxPlot > 0) {
      var zeroY = 200 - ((0 - minPlot) / plotRange) * 180
      var zeroLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      zeroLine.setAttribute('x1', '0')
      zeroLine.setAttribute('x2', '700')
      zeroLine.setAttribute('y1', String(zeroY))
      zeroLine.setAttribute('y2', String(zeroY))
      zeroLine.setAttribute('stroke', '#cbd5e1')
      zeroLine.setAttribute('stroke-width', '1.5')
      svg.appendChild(zeroLine)
    }

    var legendWrap = el('div', 'nn-studio-chart-legend')

    plotRows.forEach(function (pr, prIdx) {
      var vals = rowValues[pr.id]
      if (!vals || !vals.length) return
      var c = colors[prIdx % colors.length]

      var legItem = el('div', 'nn-studio-legend-item')
      var dot = el('span', 'nn-legend-dot')
      dot.style.backgroundColor = c
      legItem.appendChild(dot)
      legItem.appendChild(el('span', null, pr.label || pr.id))
      legendWrap.appendChild(legItem)

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      var d = ''
      var stepX = 700 / (totalMonths - 1 || 1)
      vals.forEach(function (v, mi) {
        var x = mi * stepX
        var y = 200 - ((v - minPlot) / plotRange) * 180
        if (mi === 0) d += 'M ' + x + ' ' + y
        else d += ' L ' + x + ' ' + y
      })
      path.setAttribute('d', d)
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', c)
      path.setAttribute('stroke-width', pr.id === (netRow && netRow.id) ? '3' : '2')
      svg.appendChild(path)

      vals.forEach(function (v, mi) {
        var x = mi * stepX
        var y = 200 - ((v - minPlot) / plotRange) * 180
        var dotEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        dotEl.setAttribute('cx', String(x))
        dotEl.setAttribute('cy', String(y))
        dotEl.setAttribute('r', '3.5')
        dotEl.setAttribute('fill', c)
        var tip = document.createElementNS('http://www.w3.org/2000/svg', 'title')
        tip.textContent =
          (labels[mi] || 'M' + (mi + 1)) +
          ' ' +
          (pr.label || pr.id) +
          ': ' +
          formatGridNumber(v) +
          (pr.metricUnit ? ' ' + pr.metricUnit : '')
        dotEl.appendChild(tip)
        svg.appendChild(dotEl)
      })
    })

    chartWrap.appendChild(svg)
    rightCol.appendChild(chartWrap)
    rightCol.appendChild(legendWrap)
    mainGrid.appendChild(rightCol)

    studioWrap.appendChild(mainGrid)
    studioHost.appendChild(studioWrap)
  }

  function renderTimelineGrid(container, model, meta, hooks) {
    if (!container) return
    var host = el('div', 'nn-timeline-grid-host')
    container.appendChild(host)
    var studioHost = el('div', 'nn-studio-host')
    container.appendChild(studioHost)
    var rows = Array.isArray(model && model.rows) ? model.rows : []
    if (!rows.length) {
      host.innerHTML = ''
      return
    }

    var monthsCount = Number(meta && meta.months) || 12
    var historyCount = Number(meta && meta.historyMonths) || 0
    var totalMonths = monthsCount + historyCount
    var labels = monthAxis(meta, totalMonths)

    var rowMap = {}
    rows.forEach(function (r) {
      if (r) {
        if (r.id) rowMap[normalizeKey(r.id)] = r
        if (r.label) rowMap[normalizeKey(r.label)] = r
        if (r.name) rowMap[normalizeKey(r.name)] = r
      }
    })

    var growthState = {}
    rows.forEach(function (r) {
      var g = r.growth || { mode: 'fixed', factor: 0 }
      growthState[r.id] = { mode: g.mode || 'fixed', factor: g.factor != null ? g.factor : 0 }
    })
    var overrides = {}
    var pinnedRowIds = {}
    var expandedChartRowIds = {}
    var focusedDependencyRowId = null

    function extractDirectDependencyIds(r) {
      var depIds = []
      if (Array.isArray(r.dependencies)) {
        r.dependencies.forEach(function (d) {
          var norm = normalizeKey(d)
          if (rowMap[norm] && depIds.indexOf(rowMap[norm].id) === -1) {
            depIds.push(rowMap[norm].id)
          }
        })
      }
      if (r.formula) {
        var cleaned = String(r.formula).replace(/\s+[xX]\s+/g, ' * ')
        var tokens = cleaned
          .split(/(\s*[+\-*/]\s*)/)
          .map(function (s) {
            return s.trim()
          })
          .filter(Boolean)
        tokens.forEach(function (tok) {
          if (
            !tok ||
            !isNaN(Number(tok)) ||
            tok === '+' ||
            tok === '-' ||
            tok === '*' ||
            tok === '/'
          )
            return
          var norm = normalizeKey(tok)
          var targetRow = rowMap[norm]
          if (targetRow && depIds.indexOf(targetRow.id) === -1) {
            depIds.push(targetRow.id)
          }
        })
      }
      return depIds
    }

    function getTransitiveDependencySet(startRowId) {
      var result = {}
      result[startRowId] = true
      var queue = [startRowId]
      var visited = {}
      var byId = {}
      rows.forEach(function (r) {
        if (r && r.id) byId[r.id] = r
      })

      while (queue.length > 0) {
        var currId = queue.shift()
        if (visited[currId]) continue
        visited[currId] = true
        var currRow = byId[currId]
        if (!currRow) continue
        var directDeps = extractDirectDependencyIds(currRow)
        directDeps.forEach(function (depId) {
          result[depId] = true
          if (!visited[depId]) {
            queue.push(depId)
          }
        })
      }
      return result
    }

    function recalculate() {
      var memo = {}
      var computedValues = {}
      rows.forEach(function (r) {
        var arr = []
        for (var m = 0; m < totalMonths; m++) {
          arr.push(evaluateFormulaTree(r, m, rowMap, overrides, memo, growthState, historyCount))
        }
        computedValues[r.id] = arr
      })
      return computedValues
    }

    function renderView() {
      var rowValues = recalculate()
      var activeDepSet = focusedDependencyRowId
        ? getTransitiveDependencySet(focusedDependencyRowId)
        : null
      host.innerHTML = ''

      var gridHeader = el('div', 'nn-timeline-header')
      var gridTitle = el('h3', 'nn-timeline-title', 'Timeline & P&L Projection')
      var gridActions = el('div', 'nn-timeline-actions')
      var resetBtn = el('button', 'nn-btn-reset', 'Reset Overrides')
      if (resetBtn) {
        resetBtn.setAttribute('type', 'button')
        resetBtn.addEventListener('click', function () {
          Object.keys(overrides).forEach(function (k) {
            delete overrides[k]
          })
          rows.forEach(function (r) {
            var g = r.growth || { mode: 'fixed', factor: 0 }
            growthState[r.id] = { mode: g.mode || 'fixed', factor: g.factor != null ? g.factor : 0 }
          })
          renderView()
        })
        gridActions.appendChild(resetBtn)
      }
      var exportCsvBtn = el('button', 'nn-btn-csv', 'Download CSV')
      if (exportCsvBtn) {
        exportCsvBtn.setAttribute('type', 'button')
        exportCsvBtn.addEventListener('click', function () {
          exportTimelineCsv(meta, rows, totalMonths, labels, rowValues)
        })
        gridActions.appendChild(exportCsvBtn)
      }
      if (gridHeader && gridTitle) gridHeader.appendChild(gridTitle)
      if (gridHeader && gridActions) gridHeader.appendChild(gridActions)
      if (gridHeader) host.appendChild(gridHeader)

      if (focusedDependencyRowId) {
        var focusedRow = rows.filter(function (r) {
          return r.id === focusedDependencyRowId
        })[0]
        if (focusedRow) {
          var filterBanner = el('div', 'nn-timeline-filter-banner')
          var bannerText = el('span', 'nn-filter-banner-text')
          bannerText.innerHTML =
            UI.icon('target', 14) +
            ' <span>Showing dependency tree for: <strong>' +
            escapeHtml(focusedRow.label || focusedRow.id) +
            '</strong> (' +
            Object.keys(activeDepSet).length +
            ' items)</span>'
          var clearBtn = el('button', 'nn-filter-banner-clear')
          clearBtn.setAttribute('type', 'button')
          clearBtn.innerHTML = UI.icon('close', 12) + ' <span>Clear Filter</span>'
          clearBtn.addEventListener('click', function () {
            focusedDependencyRowId = null
            renderView()
          })
          filterBanner.appendChild(bannerText)
          filterBanner.appendChild(clearBtn)
          host.appendChild(filterBanner)
        }
      }

      var tableWrap = el('div', 'nn-timeline-table-wrap')
      var table = el('table', 'nn-timeline-table')
      var thead = el('thead')
      var trHead = el('tr')

      trHead.appendChild(el('th', 'th-sticky th-metric', 'Metric'))
      trHead.appendChild(el('th', 'th-rule', 'Growth Rule'))
      trHead.appendChild(el('th', 'th-unit', 'Unit'))
      for (var m = 0; m < totalMonths; m++) {
        var isHist = m < historyCount
        var thM = el(
          'th',
          'th-month' + (isHist ? ' hist-col' : ''),
          labels[m] != null ? labels[m] : 'M' + (m + 1),
        )
        if (isHist) thM.setAttribute('title', 'Historical / Measured month')
        trHead.appendChild(thM)
      }
      trHead.appendChild(el('th', 'th-total', 'Total'))
      if (thead && trHead) thead.appendChild(trHead)
      if (table && thead) table.appendChild(thead)

      var tbody = el('tbody')

      function renderRowItem(r, isPinned) {
        var tr = el(
          'tr',
          'nn-timeline-row' +
            (r.variable ? ' is-var' : '') +
            (isPinned ? ' is-pinned' : '') +
            (focusedDependencyRowId === r.id ? ' is-focus-root' : ''),
        )
        var tdMetric = el('td', 'td-sticky td-metric')

        var actionsSpan = el('span', 'nn-row-actions')
        var isPinnedThis = !!pinnedRowIds[r.id]
        var pinBtn = el('button', 'nn-row-btn nn-pin-btn' + (isPinnedThis ? ' pinned' : ''))
        pinBtn.setAttribute('type', 'button')
        pinBtn.setAttribute('title', isPinnedThis ? 'Unpin row' : 'Pin row to top')
        pinBtn.innerHTML = UI.icon('pin', 12)
        pinBtn.addEventListener('click', function (e) {
          e.stopPropagation()
          pinnedRowIds[r.id] = !pinnedRowIds[r.id]
          renderView()
        })
        actionsSpan.appendChild(pinBtn)

        var isChartThis = !!expandedChartRowIds[r.id]
        var chartBtn = el('button', 'nn-row-btn nn-chart-btn' + (isChartThis ? ' active' : ''))
        chartBtn.setAttribute('type', 'button')
        chartBtn.setAttribute(
          'title',
          isChartThis ? 'Hide inline monthly chart' : 'Show inline monthly chart',
        )
        chartBtn.innerHTML = UI.icon('chart', 12)
        chartBtn.addEventListener('click', function (e) {
          e.stopPropagation()
          expandedChartRowIds[r.id] = !expandedChartRowIds[r.id]
          renderView()
        })
        actionsSpan.appendChild(chartBtn)

        var directDeps = extractDirectDependencyIds(r)
        if (directDeps.length > 0 || r.formula || focusedDependencyRowId === r.id) {
          var isFocusThis = focusedDependencyRowId === r.id
          var filterBtn = el('button', 'nn-row-btn nn-filter-btn' + (isFocusThis ? ' active' : ''))
          filterBtn.setAttribute('type', 'button')
          filterBtn.setAttribute(
            'title',
            isFocusThis
              ? 'Clear dependency tree filter'
              : 'Filter grid to show only dependencies of ' + (r.label || r.id),
          )
          filterBtn.innerHTML = UI.icon('target', 12)
          filterBtn.addEventListener('click', function (e) {
            e.stopPropagation()
            focusedDependencyRowId = focusedDependencyRowId === r.id ? null : r.id
            renderView()
          })
          actionsSpan.appendChild(filterBtn)
        }
        tdMetric.appendChild(actionsSpan)

        var markerSvg = r.variable
          ? UI.icon('star', 11)
          : r.source === 'derived'
            ? UI.icon('derived', 11)
            : UI.icon('calc', 11)
        var markerSpan = el(
          'span',
          'nn-row-marker marker-' + (r.variable ? 'var' : r.source === 'derived' ? 'der' : 'calc'),
        )
        markerSpan.innerHTML = markerSvg
        var nameSpan =
          UI && typeof UI.Ku === 'function'
            ? UI.Ku(
                'element',
                {
                  model: r.modelId || '',
                  id: r.id || r.label,
                  label: r.label || r.id,
                },
                { doc: container.ownerDocument || document },
              )
            : el('span', 'nn-row-name', r.label || r.id)
        if (r.formula) nameSpan.setAttribute('title', 'Formula: ' + r.formula)
        tdMetric.appendChild(markerSpan)
        tdMetric.appendChild(nameSpan)
        tr.appendChild(tdMetric)

        var tdRule = el('td', 'td-rule')
        var g = growthState[r.id] || { mode: 'fixed', factor: 0 }
        var selGrow = el('select', 'nn-grow-sel')
        var optFixed = el('option', null, 'Fixed')
        optFixed.value = 'fixed'
        if (g.mode === 'fixed') optFixed.selected = true
        var optComp = el('option', null, '% comp.')
        optComp.value = 'compound'
        if (g.mode === 'compound') optComp.selected = true
        var optAdd = el('option', null, '+delta')
        optAdd.value = 'additive'
        if (g.mode === 'additive') optAdd.selected = true
        selGrow.appendChild(optFixed)
        selGrow.appendChild(optComp)
        selGrow.appendChild(optAdd)
        selGrow.addEventListener('change', function (e) {
          growthState[r.id].mode = e.target.value
          if (inpFactor) inpFactor.disabled = e.target.value === 'fixed'
          onStateChange()
        })
        tdRule.appendChild(selGrow)

        var inpFactor = el('input', 'nn-grow-factor')
        inpFactor.type = 'number'
        inpFactor.step = 'any'
        inpFactor.value = g.factor != null ? String(g.factor) : '0'
        if (g.mode === 'fixed') inpFactor.disabled = true
        inpFactor.addEventListener('change', function (e) {
          growthState[r.id].factor = parseFloat(e.target.value) || 0
          onStateChange()
        })
        tdRule.appendChild(inpFactor)
        tr.appendChild(tdRule)

        tr.appendChild(el('td', 'td-unit', r.metricUnit || ''))

        var vals = rowValues[r.id] || []
        var sum = 0
        for (var mi = 0; mi < totalMonths; mi++) {
          var val = vals[mi] != null ? vals[mi] : 0
          sum += val
          var isHistCell = mi < historyCount
          var tdVal = el('td', 'td-num' + (isHistCell ? ' hist-cell' : ''))

          if (r.variable && !isHistCell) {
            var isOverridden =
              overrides[r.id] &&
              (typeof overrides[r.id] === 'number' || overrides[r.id][mi] !== undefined)
            var inpVar = el('input', 'nn-var-input' + (isOverridden ? ' overridden' : ''))
            inpVar.type = 'number'
            inpVar.step = 'any'
            inpVar.value = isOverridden
              ? typeof overrides[r.id] === 'number'
                ? String(overrides[r.id])
                : String(overrides[r.id][mi])
              : String(Math.round(val * 100) / 100)
            inpVar.dataset.row = r.id
            inpVar.dataset.m = String(mi)
            inpVar.addEventListener('change', function (e) {
              var rowId = e.target.dataset.row
              var monthIdx = Number(e.target.dataset.m)
              if (!overrides[rowId] || typeof overrides[rowId] === 'number') overrides[rowId] = {}
              overrides[rowId][monthIdx] = parseFloat(e.target.value) || 0
              onStateChange()
            })
            tdVal.appendChild(inpVar)
          } else {
            tdVal.textContent = formatGridNumber(val)
          }
          tr.appendChild(tdVal)
        }

        var isResultOrRev = r.metricType === 'result' || r.metricType === 'revenue'
        var totalFormatted =
          r.growth && r.growth.mode === 'fixed' && !isResultOrRev && r.variable
            ? formatGridNumber(vals[0]) + ' (avg)'
            : formatGridNumber(sum)
        tr.appendChild(el('td', 'td-num td-total', totalFormatted))

        tbody.appendChild(tr)

        if (expandedChartRowIds[r.id]) {
          var trChart = el('tr', 'nn-timeline-chart-row')
          var tdChartSticky = el('td', 'td-sticky')
          var chartLabel = el('span', 'nn-chart-row-label')
          chartLabel.innerHTML =
            UI.icon('chart', 12) + ' <span>Monthly: ' + escapeHtml(r.label || r.id) + '</span>'
          tdChartSticky.appendChild(chartLabel)
          trChart.appendChild(tdChartSticky)

          var finiteVals = vals.filter(function (v) {
            return Number.isFinite(v)
          })
          var maxAbs =
            Math.max.apply(
              null,
              finiteVals.map(function (v) {
                return Math.abs(v)
              }),
            ) || 1
          var minReal = finiteVals.length ? Math.min.apply(null, finiteVals) : NaN
          var maxReal = finiteVals.length ? Math.max.apply(null, finiteVals) : NaN

          var tdChartRule = el('td', 'td-rule')
          tdChartRule.appendChild(
            el(
              'span',
              'nn-chart-range',
              'Range: ' + formatGridNumber(minReal) + ' .. ' + formatGridNumber(maxReal),
            ),
          )
          trChart.appendChild(tdChartRule)

          trChart.appendChild(el('td', 'td-unit', r.metricUnit || ''))

          for (var ci = 0; ci < totalMonths; ci++) {
            var cVal = vals[ci] != null ? vals[ci] : 0
            var isHistCol = ci < historyCount
            var tdCell = el('td', 'td-chart-cell' + (isHistCol ? ' hist-cell' : ''))
            var barWrap = el('div', 'nn-mini-bar-wrap')
            barWrap.setAttribute(
              'title',
              (labels[ci] || 'M' + (ci + 1)) +
                ': ' +
                formatGridNumber(cVal) +
                (r.metricUnit ? ' ' + r.metricUnit : ''),
            )

            var cResolved = Number.isFinite(cVal)
            var heightPct = cResolved ? Math.max(4, Math.round((Math.abs(cVal) / maxAbs) * 100)) : 4
            var bar = el('div', 'nn-mini-bar' + (cResolved && cVal < 0 ? ' negative' : ''))
            bar.style.height = heightPct + '%'
            bar.style.backgroundColor = cResolved
              ? getSemanticBarColor(cVal, minReal, maxReal, r)
              : '#cbd5e1'

            var valLabel = el('span', 'nn-mini-bar-val', formatGridNumber(cVal))
            barWrap.appendChild(bar)
            barWrap.appendChild(valLabel)
            tdCell.appendChild(barWrap)
            trChart.appendChild(tdCell)
          }

          var tdChartTotal = el('td', 'td-total td-chart-total')
          var firstVal = vals[0] || 0
          var lastVal = vals[totalMonths - 1] || 0
          var deltaPct =
            firstVal !== 0 ? Math.round(((lastVal - firstVal) / Math.abs(firstVal)) * 100) : 0
          var trendLabel = Number.isFinite(deltaPct)
            ? (deltaPct >= 0 ? '+' : '') + deltaPct + '% trend'
            : '- trend'
          tdChartTotal.appendChild(el('div', 'nn-mini-total', trendLabel))
          trChart.appendChild(tdChartTotal)

          tbody.appendChild(trChart)
        }
      }

      var pinnedRows = rows.filter(function (r) {
        if (!pinnedRowIds[r.id]) return false
        if (activeDepSet && !activeDepSet[r.id]) return false
        return true
      })
      if (pinnedRows.length > 0) {
        var trPinnedHdr = el('tr', 'nn-timeline-grp nn-pinned-grp')
        var tdPinnedHdr = el('td')
        tdPinnedHdr.setAttribute('colspan', String(totalMonths + 4))
        var pinnedBadge = el('span', 'nn-grp-badge')
        pinnedBadge.innerHTML =
          UI.icon('pin', 12) + ' <span>PINNED METRICS (' + pinnedRows.length + ')</span>'
        tdPinnedHdr.appendChild(pinnedBadge)
        trPinnedHdr.appendChild(tdPinnedHdr)
        tbody.appendChild(trPinnedHdr)

        pinnedRows.forEach(function (r) {
          renderRowItem(r, true)
        })
      }

      var groups = []
      rows.forEach(function (r) {
        var grp = r.grp || 'GENERAL'
        if (groups.indexOf(grp) === -1) groups.push(grp)
      })

      groups.forEach(function (grp) {
        var grpRows = rows.filter(function (r) {
          if ((r.grp || 'GENERAL') !== grp) return false
          if (activeDepSet && !activeDepSet[r.id]) return false
          return true
        })
        if (!grpRows.length) return

        var trGrp = el('tr', 'nn-timeline-grp')
        var tdGrp = el('td')
        tdGrp.setAttribute('colspan', String(totalMonths + 4))
        tdGrp.appendChild(el('span', 'nn-grp-badge', grp + (activeDepSet ? ' (filtered)' : '')))
        trGrp.appendChild(tdGrp)
        tbody.appendChild(trGrp)

        grpRows.forEach(function (r) {
          renderRowItem(r, false)
        })
      })

      if (table && tbody) table.appendChild(tbody)
      if (tableWrap && table) tableWrap.appendChild(table)
      if (host && tableWrap) host.appendChild(tableWrap)
    }

    function onStateChange() {
      renderView()
      renderStudioView(
        studioHost,
        model,
        meta,
        rows,
        totalMonths,
        labels,
        rowMap,
        overrides,
        growthState,
        historyCount,
        onStateChange,
      )
    }

    renderView()
    renderStudioView(
      studioHost,
      model,
      meta,
      rows,
      totalMonths,
      labels,
      rowMap,
      overrides,
      growthState,
      historyCount,
      onStateChange,
    )
  }

  return {
    compileChartSeries: compileChartSeries,
    monthAxis: monthAxis,
    renderChart: renderChart,
    renderCharts: renderCharts,
    renderTimelineGrid: renderTimelineGrid,
    formatGridNumber: formatGridNumber,
    normalizeKey: normalizeKey,
    evaluateFormulaTree: evaluateFormulaTree,
    baseValueOf: baseValueOf,
    growValue: growValue,
  }
})
