import vus from '../../specs/V_0-3-3.json' with { type: 'json' }

const vusTyped = vus as any

const rules = {
  title: 'VUS Master Rules',
  description: vusTyped.info.description,
  type: 'object',
  render: vusTyped.api_options.render,
  system: {
    version: vusTyped.info.version,
    name: vusTyped.info.name,
    description: vusTyped.info.description,
    hierarchy: ['video', 'section', 'template', 'scene', 'layer'],
    categories: vusTyped.categories,
    api_options: vusTyped.api_options,
    speeds: vusTyped.api_options.speeds,
  },
  properties: vusTyped.properties,
}

export default rules as any
