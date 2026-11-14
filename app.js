(async function () {
  const grid = document.getElementById('recipeGrid');
  const emptyState = document.getElementById('emptyState');
  const resultCount = document.getElementById('resultCount');
  const dialog = document.getElementById('recipeDialog');
  const dialogContent = document.getElementById('dialogContent');
  const dialogClose = document.getElementById('dialogClose');

  const searchInput = document.getElementById('search');
  const maxTimeInput = document.getElementById('maxTime');
  const personsInput = document.getElementById('persons');
  const haveInput = document.getElementById('haveIngredients');
  const avoidInput = document.getElementById('avoidIngredients');
  const allergyHint = document.getElementById('allergyHint');

  const ALLERGEN_SUBSTITUTES = {
    milk: 'oat milk or almond milk',
    cream: 'coconut cream or cashew cream',
    butter: 'a neutral oil or vegan butter',
    cheese: 'nutritional yeast or a dairy-free cheese',
    paneer: 'extra-firm tofu',
    yogurt: 'coconut yogurt',
    egg: 'a flax egg (1 tbsp ground flaxseed + 3 tbsp water) per egg',
    eggs: 'a flax egg (1 tbsp ground flaxseed + 3 tbsp water) per egg',
    peanut: 'sunflower seed butter',
    peanuts: 'toasted sunflower seeds or pepitas',
    cashew: 'toasted sunflower seeds',
    almond: 'sunflower seeds or pepitas',
    walnut: 'toasted pepitas',
    wheat: 'a gluten-free flour blend',
    flour: 'a gluten-free flour blend',
    gluten: 'a gluten-free flour or noodle blend',
    soy: 'coconut aminos',
    shrimp: 'thinly sliced mushrooms',
    prawn: 'thinly sliced mushrooms',
    prawns: 'thinly sliced mushrooms',
    fish: 'extra-firm tofu or jackfruit',
    shellfish: 'mushrooms or extra-firm tofu',
    sesame: 'toasted sunflower or pepita seeds',
    dairy: 'a plant-based milk, cream, or cheese alternative',
  };

  // Replaced at deploy time by .github/workflows/deploy.yml from the
  // SUPABASE_URL / SUPABASE_ANON_KEY repository variables. For local dev,
  // fill these in directly (see supabase/schema.sql).
  const SUPABASE_URL = '__SUPABASE_URL__';
  const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

  const supabaseClient = (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  let recipes = [];
  if (supabaseClient) {
    const { data, error } = await supabaseClient.from('recipes').select('*').order('name');
    if (!error && data) recipes = data;
  }
  if (!recipes.length) {
    try {
      const res = await fetch('data/recipes.json');
      recipes = await res.json();
    } catch (err) {
      grid.replaceChildren();
      emptyState.hidden = false;
      emptyState.textContent = 'Could not load recipes — check Supabase is reachable or data/recipes.json exists.';
      return;
    }
  }

  function parseHaveList(raw) {
    return raw
      .split(/[,\n]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  function ingredientMatch(recipe, haveList) {
    if (!recipe.ingredients.length || !haveList.length) return null;
    const matched = recipe.ingredients.filter((line) => {
      const lower = line.toLowerCase();
      return haveList.some((have) => lower.includes(have) || have.includes(lower));
    });
    return { matched: matched.length, total: recipe.ingredients.length };
  }

  function allergyMatch(recipe, avoidList) {
    if (!avoidList.length) return null;
    const hits = new Set();
    for (const line of recipe.ingredients) {
      const lower = line.toLowerCase();
      for (const avoid of avoidList) {
        if (avoid && lower.includes(avoid)) hits.add(avoid);
      }
    }
    return hits.size ? hits : null;
  }

  function matchesSearch(recipe, term) {
    if (!term) return true;
    const haystack = [recipe.name, recipe.cuisine, ...(recipe.category || []), ...(recipe.tags || [])]
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  }

  function render() {
    const term = searchInput.value.trim().toLowerCase();
    const maxTime = maxTimeInput.value ? parseInt(maxTimeInput.value, 10) : null;
    const haveList = parseHaveList(haveInput.value);
    const avoidList = parseHaveList(avoidInput.value);

    const avoidedTerms = new Set();
    let filtered = recipes.filter((r) => {
      if (maxTime !== null && r.totalTime !== null && r.totalTime > maxTime) return false;
      if (!matchesSearch(r, term)) return false;
      const allergyHits = allergyMatch(r, avoidList);
      if (allergyHits) {
        for (const hit of allergyHits) avoidedTerms.add(hit);
        return false;
      }
      return true;
    });

    if (avoidedTerms.size) {
      const suggestions = [...avoidedTerms].map((term) => {
        const sub = ALLERGEN_SUBSTITUTES[term];
        return sub ? `${term} → try ${sub}` : term;
      });
      allergyHint.hidden = false;
      allergyHint.textContent = `Hiding recipes with: ${suggestions.join('; ')}.`;
    } else {
      allergyHint.hidden = true;
      allergyHint.textContent = '';
    }

    const withMatch = filtered
      .map((r) => ({ recipe: r, match: ingredientMatch(r, haveList) }))
      .filter(({ match }) => !haveList.length || (match && match.matched > 0));

    if (haveList.length) {
      withMatch.sort((a, b) => {
        const aScore = a.match ? a.match.matched / a.match.total : -1;
        const bScore = b.match ? b.match.matched / b.match.total : -1;
        if (bScore !== aScore) return bScore - aScore;
        return (a.recipe.totalTime || 0) - (b.recipe.totalTime || 0);
      });
    } else {
      withMatch.sort((a, b) => (a.recipe.totalTime || 0) - (b.recipe.totalTime || 0));
    }

    grid.replaceChildren();
    emptyState.hidden = withMatch.length > 0;
    resultCount.textContent = `${withMatch.length} recipe${withMatch.length === 1 ? '' : 's'}`;

    for (const { recipe, match } of withMatch) {
      grid.appendChild(renderCard(recipe, match));
    }
  }

  function renderCard(recipe, match) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'recipe-card';
    btn.addEventListener('click', () => openDetail(recipe));

    const title = document.createElement('h3');
    title.textContent = recipe.name;
    btn.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'recipe-meta';
    meta.appendChild(badge(recipe.cuisine));
    if (recipe.totalTime !== null) meta.appendChild(badge(`${recipe.totalTime} min`));
    if (recipe.nutrition && recipe.nutrition.calories) meta.appendChild(badge(`${recipe.nutrition.calories} kcal`));
    for (const cat of recipe.category || []) meta.appendChild(badge(cat));
    btn.appendChild(meta);

    if (match) {
      const b = badge(`${match.matched}/${match.total} ingredients`);
      b.classList.add('badge-match');
      btn.appendChild(b);
    } else if (haveInput.value.trim() && recipe.ingredients.length === 0) {
      const b = document.createElement('span');
      b.className = 'no-data';
      b.textContent = 'No ingredient data yet';
      btn.appendChild(b);
    }

    li.appendChild(btn);
    return li;
  }

  function badge(text) {
    const span = document.createElement('span');
    span.className = 'badge';
    span.textContent = text;
    return span;
  }

  function scaleText(text, factor) {
    if (!factor || factor === 1) return text;
    return text.replace(/\d+(\.\d+)?/g, (m) => {
      const scaled = Math.round(parseFloat(m) * factor * 100) / 100;
      return String(scaled);
    });
  }

  function openDetail(recipe) {
    const persons = Math.max(1, parseInt(personsInput.value, 10) || recipe.servings || 4);
    const servings = recipe.servings || 4;
    const factor = persons / servings;

    dialogContent.replaceChildren();

    const h2 = document.createElement('h2');
    h2.textContent = recipe.name;
    dialogContent.appendChild(h2);

    const meta = document.createElement('div');
    meta.className = 'recipe-meta';
    meta.appendChild(badge(recipe.cuisine));
    if (recipe.prepTime !== null) meta.appendChild(badge(`Prep ${recipe.prepTime} min`));
    if (recipe.cookTime !== null) meta.appendChild(badge(`Cook ${recipe.cookTime} min`));
    if (recipe.totalTime !== null) meta.appendChild(badge(`Total ${recipe.totalTime} min`));
    meta.appendChild(badge(`${persons} ${persons === 1 ? 'person' : 'people'} (recipe serves ${servings})`));
    if (recipe.rating) meta.appendChild(badge(`Rating ${recipe.rating}`));
    dialogContent.appendChild(meta);

    const ingH = document.createElement('h3');
    ingH.textContent = 'Ingredients';
    dialogContent.appendChild(ingH);
    if (recipe.ingredients.length) {
      const ul = document.createElement('ul');
      for (const line of recipe.ingredients) {
        const li = document.createElement('li');
        li.textContent = scaleText(line, factor);
        ul.appendChild(li);
      }
      dialogContent.appendChild(ul);
    } else {
      dialogContent.appendChild(noData('Ingredients not added yet.'));
    }

    const insH = document.createElement('h3');
    insH.textContent = 'Instructions';
    dialogContent.appendChild(insH);
    if (recipe.instructions.length) {
      const ol = document.createElement('ol');
      for (const step of recipe.instructions) {
        const li = document.createElement('li');
        li.textContent = step;
        ol.appendChild(li);
      }
      dialogContent.appendChild(ol);
    } else {
      dialogContent.appendChild(noData('Instructions not added yet.'));
    }

    if (recipe.nutrition) {
      const nutH = document.createElement('h3');
      nutH.textContent = 'Nutrition (per serving)';
      dialogContent.appendChild(nutH);
      dialogContent.appendChild(nutritionGrid(recipe.nutrition));
    }

    if (recipe.notes) {
      const notesH = document.createElement('h3');
      notesH.textContent = 'Notes';
      dialogContent.appendChild(notesH);
      const p = document.createElement('p');
      p.textContent = recipe.notes;
      dialogContent.appendChild(p);
    }

    if (recipe.source) {
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = recipe.source;
      a.textContent = 'Source';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      p.appendChild(a);
      dialogContent.appendChild(p);
    }

    dialog.showModal();
  }

  function noData(text) {
    const p = document.createElement('p');
    p.className = 'no-data';
    p.textContent = text;
    return p;
  }

  function nutritionGrid(nutrition) {
    const div = document.createElement('div');
    div.className = 'nutrition-grid';
    const stats = [
      ['Calories', nutrition.calories, 'kcal'],
      ['Protein', nutrition.protein, 'g'],
      ['Carbs', nutrition.carbs, 'g'],
      ['Fat', nutrition.fat, 'g'],
    ];
    for (const [label, value, unit] of stats) {
      if (value === null || value === undefined) continue;
      const stat = document.createElement('div');
      stat.className = 'nutrition-stat';
      const val = document.createElement('span');
      val.className = 'nutrition-value';
      val.textContent = `${value}${unit === 'kcal' ? '' : 'g'}`;
      const lab = document.createElement('span');
      lab.className = 'nutrition-label';
      lab.textContent = unit === 'kcal' ? `${label} (kcal)` : label;
      stat.appendChild(val);
      stat.appendChild(lab);
      div.appendChild(stat);
    }
    return div;
  }

  dialogClose.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  for (const el of [searchInput, maxTimeInput, haveInput, avoidInput]) {
    el.addEventListener('input', render);
  }
  personsInput.addEventListener('input', render);

  render();

  // --- Tabs ---

  const tabRecipes = document.getElementById('tabRecipes');
  const tabPlan = document.getElementById('tabPlan');
  const recipesView = document.getElementById('recipesView');
  const planView = document.getElementById('planView');

  function showTab(tab) {
    const isRecipes = tab === 'recipes';
    recipesView.hidden = !isRecipes;
    planView.hidden = isRecipes;
    tabRecipes.classList.toggle('tab-active', isRecipes);
    tabRecipes.setAttribute('aria-selected', String(isRecipes));
    tabPlan.classList.toggle('tab-active', !isRecipes);
    tabPlan.setAttribute('aria-selected', String(!isRecipes));
    if (!isRecipes) renderPlan();
  }

  tabRecipes.addEventListener('click', () => showTab('recipes'));
  tabPlan.addEventListener('click', () => showTab('plan'));

  // --- Meal plan calendar ---

  const recipesById = new Map(recipes.map((r) => [r.id, r]));

  // --- Add a recipe ---

  const openAddRecipe = document.getElementById('openAddRecipe');
  const addRecipeDialog = document.getElementById('addRecipeDialog');
  const addRecipeForm = document.getElementById('addRecipeForm');
  const addRecipeStatus = document.getElementById('addRecipeStatus');
  const addRecipeClose = document.getElementById('addRecipeClose');

  openAddRecipe.disabled = !supabaseClient;
  openAddRecipe.title = supabaseClient ? '' : 'Connect a Supabase project in app.js to enable this (see supabase/schema.sql)';

  openAddRecipe.addEventListener('click', () => {
    addRecipeStatus.textContent = '';
    addRecipeForm.reset();
    addRecipeDialog.showModal();
  });
  addRecipeClose.addEventListener('click', () => addRecipeDialog.close());
  addRecipeDialog.addEventListener('click', (e) => {
    if (e.target === addRecipeDialog) addRecipeDialog.close();
  });

  function splitLines(raw) {
    return raw.split('\n').map((s) => s.trim()).filter(Boolean);
  }

  function splitCommas(raw) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  function slugify(name) {
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  addRecipeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabaseClient) return;

    const name = document.getElementById('newName').value.trim();
    if (!name) return;

    const prepTime = parseInt(document.getElementById('newPrepTime').value, 10) || null;
    const cookTime = parseInt(document.getElementById('newCookTime').value, 10) || null;

    const calories = parseInt(document.getElementById('newCalories').value, 10);
    const protein = parseInt(document.getElementById('newProtein').value, 10);
    const carbs = parseInt(document.getElementById('newCarbs').value, 10);
    const fat = parseInt(document.getElementById('newFat').value, 10);
    const nutrition = [calories, protein, carbs, fat].some((n) => !isNaN(n))
      ? {
        calories: isNaN(calories) ? null : calories,
        protein: isNaN(protein) ? null : protein,
        carbs: isNaN(carbs) ? null : carbs,
        fat: isNaN(fat) ? null : fat,
      }
      : null;

    const newRecipe = {
      id: `${slugify(name)}-${Date.now().toString(36)}`,
      name,
      cuisine: document.getElementById('newCuisine').value.trim() || null,
      category: splitCommas(document.getElementById('newCategory').value),
      tags: splitCommas(document.getElementById('newTags').value),
      prepTime,
      cookTime,
      totalTime: (prepTime || 0) + (cookTime || 0) || null,
      servings: parseInt(document.getElementById('newServings').value, 10) || 4,
      nutrition,
      rating: null,
      source: '',
      tried: false,
      ingredients: splitLines(document.getElementById('newIngredients').value),
      instructions: splitLines(document.getElementById('newInstructions').value),
      notes: document.getElementById('newNotes').value.trim() || null,
    };

    addRecipeStatus.textContent = 'Saving…';
    const { error } = await supabaseClient.from('recipes').insert(newRecipe);
    if (error) {
      addRecipeStatus.textContent = 'Could not save the recipe. Try again.';
      return;
    }

    recipes.push(newRecipe);
    recipesById.set(newRecipe.id, newRecipe);
    addRecipeDialog.close();
    render();
  });

  // --- Meal plan calendar ---

  const PLAN_STORAGE_KEY = 'recipeManager.mealPlan';

  function loadPlan() {
    try {
      return JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY)) || {};
    } catch (err) {
      return {};
    }
  }

  function savePlan(plan) {
    try {
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
    } catch (err) {
      // storage unavailable (private browsing, quota) — plan just won't persist
    }
  }

  let plan = loadPlan();

  const today = new Date();
  let planYear = today.getFullYear();
  let planMonth = today.getMonth();

  const planMonthLabel = document.getElementById('planMonthLabel');
  const planWeekdays = document.getElementById('planWeekdays');
  const planGrid = document.getElementById('planGrid');
  const planPrev = document.getElementById('planPrev');
  const planNext = document.getElementById('planNext');

  const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  function dateKey(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  for (const name of WEEKDAY_NAMES) {
    const span = document.createElement('span');
    span.textContent = name;
    planWeekdays.appendChild(span);
  }

  function renderPlan() {
    planMonthLabel.textContent = `${MONTH_NAMES[planMonth]} ${planYear}`;
    planGrid.replaceChildren();

    const firstOfMonth = new Date(planYear, planMonth, 1);
    const startOffset = firstOfMonth.getDay();
    const daysInMonth = new Date(planYear, planMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(planYear, planMonth, 0).getDate();

    const cells = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({ day: daysInPrevMonth - i, outside: true, y: planYear, m: planMonth - 1 });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, outside: false, y: planYear, m: planMonth });
    }
    let nextMonthDay = 1;
    while (cells.length % 7 !== 0) {
      cells.push({ day: nextMonthDay++, outside: true, y: planYear, m: planMonth + 1 });
    }

    for (const cell of cells) {
      const normalized = new Date(cell.y, cell.m, cell.day);
      const key = dateKey(normalized.getFullYear(), normalized.getMonth(), normalized.getDate());
      const isToday = key === dateKey(today.getFullYear(), today.getMonth(), today.getDate());

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'plan-day';
      if (cell.outside) btn.classList.add('plan-day-outside');
      if (isToday) btn.classList.add('plan-day-today');
      btn.addEventListener('click', () => openPlanDay(key, normalized));

      const num = document.createElement('span');
      num.className = 'plan-day-num';
      num.textContent = String(cell.day);
      btn.appendChild(num);

      for (const recipeId of plan[key] || []) {
        const recipe = recipesById.get(recipeId);
        if (!recipe) continue;
        const chip = document.createElement('span');
        chip.className = 'plan-day-chip';
        chip.textContent = recipe.name;
        btn.appendChild(chip);
      }

      planGrid.appendChild(btn);
    }
  }

  planPrev.addEventListener('click', () => {
    planMonth -= 1;
    if (planMonth < 0) { planMonth = 11; planYear -= 1; }
    renderPlan();
  });
  planNext.addEventListener('click', () => {
    planMonth += 1;
    if (planMonth > 11) { planMonth = 0; planYear += 1; }
    renderPlan();
  });

  // --- Day assignment dialog ---

  const planDayDialog = document.getElementById('planDayDialog');
  const planDayClose = document.getElementById('planDayClose');
  const planDayTitle = document.getElementById('planDayTitle');
  const planDaySearch = document.getElementById('planDaySearch');
  const planDayResults = document.getElementById('planDayResults');
  const planDayAssigned = document.getElementById('planDayAssigned');

  let activeDayKey = null;

  function openPlanDay(key, dateObj) {
    activeDayKey = key;
    planDayTitle.textContent = dateObj.toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    planDaySearch.value = '';
    renderDayResults('');
    renderDayAssigned();
    planDayDialog.showModal();
  }

  function renderDayResults(term) {
    planDayResults.replaceChildren();
    if (!term.trim()) return;
    const lower = term.trim().toLowerCase();
    const matches = recipes.filter((r) => r.name.toLowerCase().includes(lower)).slice(0, 8);
    for (const recipe of matches) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = recipe.name;
      btn.addEventListener('click', () => {
        const assigned = plan[activeDayKey] || (plan[activeDayKey] = []);
        if (!assigned.includes(recipe.id)) assigned.push(recipe.id);
        savePlan(plan);
        renderDayAssigned();
        renderPlan();
      });
      li.appendChild(btn);
      planDayResults.appendChild(li);
    }
  }

  function renderDayAssigned() {
    planDayAssigned.replaceChildren();
    const assigned = plan[activeDayKey] || [];
    if (!assigned.length) {
      const li = document.createElement('li');
      li.className = 'no-data';
      li.textContent = 'Nothing planned yet.';
      planDayAssigned.appendChild(li);
      return;
    }
    for (const recipeId of assigned) {
      const recipe = recipesById.get(recipeId);
      if (!recipe) continue;
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = recipe.name;
      li.appendChild(span);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', `Remove ${recipe.name}`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        plan[activeDayKey] = plan[activeDayKey].filter((id) => id !== recipeId);
        savePlan(plan);
        renderDayAssigned();
        renderPlan();
      });
      li.appendChild(removeBtn);
      planDayAssigned.appendChild(li);
    }
  }

  planDaySearch.addEventListener('input', () => renderDayResults(planDaySearch.value));
  planDayClose.addEventListener('click', () => planDayDialog.close());
  planDayDialog.addEventListener('click', (e) => {
    if (e.target === planDayDialog) planDayDialog.close();
  });
})();
