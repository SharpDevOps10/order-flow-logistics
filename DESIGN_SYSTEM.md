# Design System — Order Flow Logistics

A unified standard дизайну для всіх фіч проєкту. Будь-який новий компонент, в'ю або лейаут **зобов'язаний** слідувати цьому
документу.

---

## 1. Principles

| Principle         | Essence                                                                    |
|-----------------|-------------------------------------------------------------------------|
| **Clarity**     | UI is not overloaded. Every element на сторінці виправданий             |
| **Consistency** | Identical actions виглядають однаково в усіх ролях                           |
| **Hierarchy**   | The most important action — найвиразніша. Текст читається від великого до малого |
| **Feedback**    | Every action супроводжується станом: loading / success / error             |
| **Role-Aware**  | Accent color відповідає ролі користувача                               |

---

## 2. Color Palette

### Basic Colors (нейтральні)

| Токен          | Class Tailwind     | Hex     | Usage              |
|----------------|-------------------|---------|---------------------------|
| Surface        | `bg-white`        | #ffffff | Cards, modals, navbar   |
| Background     | `bg-gray-50`      | #f9fafb | Page background              |
| Border         | `border-gray-100` | #f3f4f6 | Dividers, cards       |
| Border Strong  | `border-gray-200` | #e5e7eb | Inputs, navbar            |
| Text Primary   | `text-gray-900`   | #111827 | Headings, main text |
| Text Secondary | `text-gray-600`   | #4b5563 | Captions, meta text       |
| Text Muted     | `text-gray-400`   | #9ca3af | Placeholders, disabled    |

### Accent (Brand)

| Токен         | Class Tailwind   | Usage                       |
|---------------|-----------------|------------------------------------|
| Brand         | `blue-600`      | CTA, primary button, active links |
| Brand Hover   | `blue-700`      | Hover state primary                 |
| Brand Surface | `blue-50`       | Tooltip background, highlighted sections   |
| Brand Border  | `blue-100`      | Border in blue-tinted cards        |
| Brand Text    | `text-blue-600` | Active links, labels              |

### Semantic Colors

| State    | bg          | text         | border       |
|---------|-------------|--------------|--------------|
| Success | `green-50`  | `green-700`  | `green-100`  |
| Warning | `yellow-50` | `yellow-700` | `yellow-100` |
| Error   | `red-50`    | `red-600`    | `red-100`    |
| Info    | `blue-50`   | `blue-700`   | `blue-100`   |

### Role Colors (Role Theme)

Each role має свій акцентний колір. Used у навігації, бейджах та заголовках.

| Роль         | bg-subtle   | text         | border       | bg-solid     | text-on-solid |
|--------------|-------------|--------------|--------------|--------------|---------------|
| **CLIENT**   | `blue-50`   | `blue-700`   | `blue-100`   | `blue-600`   | `white`       |
| **SUPPLIER** | `green-50`  | `green-700`  | `green-100`  | `green-600`  | `white`       |
| **COURIER**  | `orange-50` | `orange-700` | `orange-100` | `orange-600` | `white`       |
| **ADMIN**    | `purple-50` | `purple-700` | `purple-100` | `purple-600` | `white`       |

---

## 3. Typography

System font (Inter / -apple-system / sans-serif). No custom font loading.

### Heading Scale

| Level  | Class                                                           | Size | Where Used         |
|---------|----------------------------------------------------------------|--------|-----------------------------|
| Display | `text-5xl font-extrabold text-gray-900`                        | 48px   | Landing hero                |
| H1      | `text-3xl font-bold text-gray-900`                             | 30px   | Page title (page title) |
| H2      | `text-xl font-semibold text-gray-900`                          | 20px   | Section or card heading |
| H3      | `text-base font-semibold text-gray-900`                        | 16px   | List element heading   |
| Label   | `text-xs font-semibold uppercase tracking-wider text-gray-500` | 12px   | Field labels, categories    |

### Text Scale

| Level  | Class                                    | Where Used   |
|---------|-----------------------------------------|-----------------------|
| Body    | `text-sm text-gray-600`                 | Main content      |
| Caption | `text-xs text-gray-400`                 | Meta-data, timestamps |
| Link    | `text-sm text-blue-600 hover:underline` | Clickable links     |

---

## 4. Spacing (Spacing)

Base unit = **4px** (Tailwind: `1 unit = 0.25rem`).

| Назва                    | Значення | Де                               |
|--------------------------|----------|----------------------------------|
| `gap-1`                  | 4px      | Tight groups (icon + text)       |
| `gap-2`                  | 8px      | Element pairs                   |
| `gap-3`                  | 12px     | List items                       |
| `gap-4`                  | 16px     | Forms, cards within          |
| `gap-6`                  | 24px     | Navbar, sections within         |
| `gap-8`                  | 32px     | Між великими блоками             |
| `py-8` / `px-6`          |          | Внутрішній padding main-контенту |
| `py-20`                  |          | Padding великих лендінг-секцій   |
| `max-w-6xl mx-auto px-6` |          | Stateдартний контейнер            |
| `max-w-md`               |          | Форми авторизації                |

---

## 5. Закруглення (Border Radius)

| Class           | Де                                 |
|----------------|------------------------------------|
| `rounded-lg`   | Інпути, маленькі кнопки            |
| `rounded-xl`   | Stateдартні кнопки, тех-стек картки |
| `rounded-2xl`  | Картки (cards)                     |
| `rounded-full` | Бейджі-пілюлі, аватари, індикатори |

---

## 6. Тіні (Shadows)

Мінімалістичне використання. Тінь — це сигнал інтерактивності або elevation.

| Class              | Де                         |
|-------------------|----------------------------|
| `shadow-sm`       | Картки у спокої (статичні) |
| `hover:shadow-md` | Картки при hover           |
| _(немає тіні)_    | Inline-елементи, таблиці   |

---

## 7. Компоненти

### 7.1 AppButton

**Файл:** `src/components/common/AppButton.vue`

#### Варіанти

| Variant     | Вигляд                 | Class                                                             |
|-------------|------------------------|------------------------------------------------------------------|
| `primary`   | Синій фон, білий текст | `bg-blue-600 hover:bg-blue-700 text-white`                       |
| `secondary` | Білий, сіра рамка      | `bg-white border border-gray-200 hover:bg-gray-50 text-gray-700` |
| `ghost`     | Без фону               | `text-gray-600 hover:bg-gray-100 hover:text-gray-900`            |
| `danger`    | Червоний               | `bg-red-600 hover:bg-red-700 text-white`                         |

#### Sizeи

| Size           | Class                             |
|----------------|----------------------------------|
| `sm`           | `text-sm px-3 py-1.5 rounded-lg` |
| `md` (default) | `text-sm px-4 py-2 rounded-xl`   |
| `lg`           | `text-base px-6 py-3 rounded-xl` |

#### Stateи

- `disabled`: `opacity-50 cursor-not-allowed`
- `loading`: іконка спінера замість тексту, `disabled`

```vue
<!-- Usage -->
<AppButton>Зберегти</AppButton>
<AppButton variant="secondary">Скасувати</AppButton>
<AppButton variant="danger" size="sm">Видалити</AppButton>
<AppButton :loading="isLoading">Підтвердити</AppButton>
```

---

### 7.2 AppInput

**Файл:** `src/components/common/AppInput.vue`

- Label зверху: `text-sm font-medium text-gray-700 mb-1`
- Інпут:
  `w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`
- Error state: `border-red-400 focus:ring-red-400`
- Error message: `text-xs text-red-500 mt-1`
- Helper text: `text-xs text-gray-400 mt-1`

```vue
<!-- Usage -->
<AppInput v-model="email" label="Email" type="email" placeholder="user@example.com" />
<AppInput v-model="password" label="Пароль" type="password" :error="errors.password" />
<AppInput v-model="price" label="Ціна" type="number" helper="В гривнях" />
```

---

### 7.3 AppBadge

**Файл:** `src/components/common/AppBadge.vue`

Маленький статусний бейдж. Не клікабельний.

| Variant   | Class                           |
|-----------|--------------------------------|
| `default` | `bg-gray-100 text-gray-600`    |
| `blue`    | `bg-blue-50 text-blue-700`     |
| `green`   | `bg-green-50 text-green-700`   |
| `yellow`  | `bg-yellow-50 text-yellow-700` |
| `red`     | `bg-red-50 text-red-600`       |
| `orange`  | `bg-orange-50 text-orange-700` |
| `purple`  | `bg-purple-50 text-purple-700` |

Базовий клас: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`

```vue
<!-- Usage -->
<AppBadge variant="green">ACCEPTED</AppBadge>
<AppBadge variant="yellow">PENDING</AppBadge>
<AppBadge variant="blue">READY</AppBadge>
```

---

### 7.4 AppModal

**Файл:** `src/components/common/AppModal.vue`

- Overlay: `fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4`
- Картка: `bg-white rounded-2xl shadow-xl w-full max-w-md`
- Header: `flex items-center justify-between px-6 py-4 border-b border-gray-100`
- Body: `px-6 py-5`
- Footer: `flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100`

```vue
<!-- Usage -->
<AppModal v-model="isOpen" title="Призначити кур'єра">
  <template #default><!-- content --></template>
  <template #footer>
    <AppButton variant="secondary" @click="isOpen = false">Скасувати</AppButton>
    <AppButton @click="confirm">Підтвердити</AppButton>
  </template>
</AppModal>
```

---

### 7.5 AppSpinner

**Файл:** `src/components/common/AppSpinner.vue`

SVG-анімація. Sizeи: `sm` (16px), `md` (24px, default), `lg` (40px).

```vue
<!-- Usage -->
<AppSpinner />
<AppSpinner size="lg" class="text-blue-600" />
```

---

### 7.6 AppToast

**Файл:** `src/components/common/AppToast.vue`

Глобальне сповіщення. Позиціонується через `fixed bottom-4 right-4 z-50`.

| Тип       | Іконка | Колір       |
|-----------|--------|-------------|
| `success` | ✓      | `green-600` |
| `error`   | ✕      | `red-600`   |
| `info`    | ℹ      | `blue-600`  |

---

## 8. Паттерни лейаутів

### Навігаційна панель (Navbar)

```
bg-white border-b border-gray-200 sticky top-0 z-10
├── max-w-6xl mx-auto px-6 h-14 flex items-center justify-between
│   ├── LEFT: Logo + nav-links (gap-6)
│   └── RIGHT: User info + Logout button
```

- Висота: `h-14` (56px)
- Лого: `text-base font-bold text-gray-900` + badge ролі
- Nav-link inactive: `text-sm text-gray-500 hover:text-gray-900 transition-colors`
- Nav-link active: `text-sm text-blue-600 font-medium`

### Main content (Main)

```
bg-gray-50 min-h-screen
└── main.max-w-6xl.mx-auto.px-6.py-8
    └── <RouterView />
```

### Сторінка (Page)

```
<!-- Заголовок -->
<div class="flex items-center justify-between mb-6">
  <h1 class="text-3xl font-bold text-gray-900">Назва</h1>
  <AppButton>Дія</AppButton>
</div>

<!-- Контент -->
```

---

## 9. Паттерни стану

### Loading

```vue

<div v-if="loading" class="flex items-center justify-center py-20">
  <AppSpinner size="lg" />
</div>
```

### Error

```vue

<div v-else-if="error" class="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
  <p class="text-sm text-red-600">{{ error }}</p>
  <AppButton variant="ghost" size="sm" class="mt-3" @click="retry">Спробувати знову</AppButton>
</div>
```

### Empty state

```vue

<div v-else-if="!items.length" class="text-center py-20">
  <p class="text-4xl mb-3">📭</p>
  <p class="text-base font-semibold text-gray-900 mb-1">Поки що порожньо</p>
  <p class="text-sm text-gray-400">Додайте перший елемент</p>
</div>
```

### Inline field error

```vue
<p v-if="errors.field" class="text-xs text-red-500 mt-1">{{ errors.field }}</p>
```

---

## 10. Картки (Cards)

### Stateдартна картка

```html

<div class="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-shadow">
  <!-- content -->
</div>
```

### Статусна картка (з кольоровою смугою)

```html

<div class="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
  <div class="h-1 bg-blue-600"></div>  <!-- або green, orange, red залежно від статусу -->
  <div class="p-5"><!-- content --></div>
</div>
```

### Grid карток

```html

<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  <!-- cards -->
</div>
```

---

## 11. Форми

```html

<form class="space-y-4" @submit.prevent="handleSubmit">
  <AppInput v-model="form.name" label="Назва" />
  <AppInput v-model="form.email" label="Email" type="email" />

  <div class="flex items-center justify-end gap-3 pt-2">
    <AppButton type="button" variant="secondary" @click="cancel">Скасувати</AppButton>
    <AppButton type="submit" :loading="isLoading">Зберегти</AppButton>
  </div>
</form>
```

---

## 12. Таблиці

```html

<div class="bg-white border border-gray-100 rounded-2xl overflow-hidden">
  <table class="w-full text-sm">
    <thead class="border-b border-gray-100 bg-gray-50">
    <tr>
      <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
        Колонка
      </th>
    </tr>
    </thead>
    <tbody class="divide-y divide-gray-50">
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-5 py-4 text-gray-900">Значення</td>
    </tr>
    </tbody>
  </table>
</div>
```

---

## 13. Анімації та переходи

| Class                 | Де                                   |
|----------------------|--------------------------------------|
| `transition-colors`  | Зміна кольору (hover кнопок, лінків) |
| `transition-shadow`  | Hover карток                         |
| `transition-opacity` | Show/hide елементи                   |
| `duration-200`       | Stateдартна тривалість                |
| `animate-pulse`      | Індикатори активного стану           |
| `animate-spin`       | AppSpinner                           |

Vue-переходи для модалок та тостів:

```vue

<Transition name="fade">
  <!-- overlay -->
</Transition>

<style scoped>
  .fade-enter-active, .fade-leave-active {
    transition: opacity 0.2s;
  }

  .fade-enter-from, .fade-leave-to {
    opacity: 0;
  }
</style>
```

---

## 14. Анти-паттерни (заборонено)

| Що                                           | Чому                    |
|----------------------------------------------|-------------------------|
| Довільні кольори (`text-[#3b82f6]`)          | Порушує консистентність |
| `shadow-lg`, `shadow-xl` на картках          | Перевантажує UI         |
| Різні розміри кнопок в одному блоці          | Порушує ієрархію        |
| Inline-стилі                                 | Складно підтримувати    |
| Жорсткий `px` для відступів (не Tailwind)    | Не скейлиться           |
| Текст більший за `text-3xl` в шапці сторінки | Тільки для landing hero |
| `border-2` на картках                        | Занадто важко           |
| Більше 3 кольорів на одній картці            | Візуальний шум          |

---

## 15. Чеклист перед PR

- [ ] Всі відступи з Tailwind spacing scale
- [ ] Кольори тільки з палітри вище
- [ ] Loading / Error / Empty стан реалізовані
- [ ] Кнопки мають hover + disabled стан
- [ ] Форми мають валідацію з помилками
- [ ] Компонент до 200 рядків (або розбитий на дочірні)
- [ ] Використані `AppButton`, `AppInput`, `AppBadge` замість raw HTML
