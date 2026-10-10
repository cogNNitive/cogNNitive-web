/* procedures/assets/console-view-procedure.js — the Procedures stepper registered
   as a console view (bluepriNNt convention: flat under assets/, prefix
   console-view-). It hands the shared payload to InnfoProcedureStepper.mount,
   which builds its own DOM inside the container and never uses global ids. */
registerView({
  title: 'Procedure',
  icon: 'list',
  order: 20,
  kind: 'editable',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var stepper = typeof InnfoProcedureStepper !== 'undefined' ? InnfoProcedureStepper : null
    if (!stepper || typeof stepper.mount !== 'function') {
      var empty = doc.createElement('p')
      empty.className = 'empty-state'
      empty.textContent = 'Procedure runtime is not available.'
      ctx.container.appendChild(empty)
      return
    }
    return (
      stepper.mount(ctx.container, {
        schema: ctx.payload.schema,
        model: ctx.payload.model,
      }) || {}
    )
  },
})
