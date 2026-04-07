# 🎓 Project Context: Веб-система опрацювання замовлень з оптимізацією маршрутів

## 🎯 Суть та мета дипломної роботи

Розробка мультитенантної (SaaS) платформи для малого бізнесу (агрегатор/маркетплейс).
Система дозволяє постачальникам (SUPPLIER) створювати свої магазини та керувати товарами. Клієнти (CLIENT) роблять
замовлення, а кур'єри (COURIER) отримують оптимізовані маршрути доставки на основі алгоритму графової оптимізації (
Дейкстра). Адміністратор (ADMIN) модерує магазини.

## 🛠 Технічний стек (Backend)

- **Фреймворк:** NestJS (TypeScript)
- **База даних:** PostgreSQL + Drizzle ORM
- **Автентифікація:** Passport.js (JWT Access/Refresh токени), Argon2 (хешування)
- **Валідація:** `class-validator`, `class-transformer`

## ⚖️ Рольова модель (RBAC)

Використовується суворий `enum Role { ADMIN, CLIENT, SUPPLIER, COURIER }`.

- **ADMIN:** Модерація системи (підтвердження `isApproved` для організацій).
- **SUPPLIER:** Власник бізнесу. Може створювати кілька `Organizations`, додавати `Products` тільки у свої організації,
  керувати своїми `Orders`.
- **CLIENT:** Може переглядати підтверджені організації, створювати замовлення.
- **COURIER:** Отримує доступ до призначених йому замовлень та оптимізованого маршруту.

## 📜 Головні правила кодування (AI Instructions)

1. **NO `any`!** Усі типи мають бути суворо визначені. Використовувати інтерфейси для розширення (наприклад,
   `RequestWithUser extends Request`).
2. **DTO & Validation:** Усі вхідні дані проходять через DTO класи з декораторами `class-validator`.
3. **Security First:** Усі роути захищені `AccessTokenGuard`. Доступ по ролях через `@Roles()`. Ресурси, що належать
   юзеру, захищені кастомними Guards (наприклад, `OrganizationOwnershipGuard`).
4. **Thin Controllers:** Контролери лише приймають запити та віддають відповіді. Уся бізнес-логіка (робота з Drizzle)
   лежить у Service.

---

## 🏗 Детальний план реалізації модулів

### ✅ Модуль 1: Auth & Users (РЕАЛІЗОВАНО)

- Реєстрація з вибором ролі (без можливості вибрати ADMIN).
- Логін з генерацією пари Access + Refresh токенів.
- Refresh ендпоїнт з перевіркою хешу рефреш-токена в БД.
- Кастомні декоратори: `@GetCurrentUser()`, `@Roles()`.
- Стратегії: `JwtStrategy`, `RefreshTokenStrategy`.

### ✅ Модуль 2: Organizations (РЕАЛІЗОВАНО)

- Відношення: `1:N` (1 Постачальник може мати багато Організацій).
- Логіка модерації: Створена організація має `isApproved: 0`. Доступна клієнтам тільки після того, як ADMIN зробить
  `PATCH /organizations/:id/approve`.
- Захист: `OrganizationOwnershipGuard` гарантує, що `PATCH /organizations/:id` може виконати тільки власник (`ownerId`).

### ⏳ Модуль 3: Products (НАСТУПНИЙ КРОК)

- **Таблиця БД:** `products` (id, name, description, price (int), organizationId).
- **Архітектура API:** Використання Nested Routes для зручної перевірки власності.
    - `POST /organizations/:orgId/products` (Тільки SUPPLIER-власник).
    - `GET /organizations/:orgId/products` (Публічно для всіх).
    - `PATCH/DELETE /products/:id` (Тільки SUPPLIER-власник).
- **Завдання:** Створити `CreateProductDto`, `ProductsService`, та використати існуючий `OrganizationOwnershipGuard` для
  захисту роутів.

### ⏳ Модуль 4: Orders (Замовлення)

- **Таблиці БД:** - `orders` (id, clientId, organizationId, status, totalAmount, deliveryAddress, coordinates).
    - `order_items` (orderId, productId, quantity, priceAtPurchase).
- **Логіка:**
    - CLIENT створює замовлення в конкретній Організації.
    - SUPPLIER бачить замовлення тільки своїх Організацій і може змінювати статус (PENDING -> ACCEPTED ->
      READY_FOR_DELIVERY).
    - Статуси замовлень: `Enum OrderStatus`.

### ⏳ Модуль 5: Route Optimization (Алгоритм Дейкстри)

- **Суть:** Наукова частина диплома.
- **Реалізація:** Окремий `RoutingService`.
- **Логіка:** Коли замовлення переходить у статус `READY_FOR_DELIVERY`, система генерує граф на основі регіону/координат
  організації та адреси доставки клієнта.
- Алгоритм Дейкстри розраховує найкоротший шлях або оптимальний ланцюжок доставки (якщо кур'єр бере кілька замовлень з
  однієї організації).
- **Ендпоїнт:** `GET /courier/route` — повертає масив точок маршруту.