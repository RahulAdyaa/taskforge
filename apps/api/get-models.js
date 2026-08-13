fetch('https://openrouter.ai/api/v1/models')
  .then(res => res.json())
  .then(data => {
    const freeModels = data.data.filter(m => m.pricing.prompt === "0" && m.pricing.completion === "0");
    console.log("Free models available:");
    freeModels.forEach(m => console.log(m.id));
  })
  .catch(err => console.error(err));
