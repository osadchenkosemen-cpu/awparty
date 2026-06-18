// Конфиг подключения к Supabase для ОБЩЕЙ таблицы рекордов.
//
// Как заполнить (см. инструкцию, что я дам в чате):
//   1. Создай проект на supabase.com.
//   2. Settings -> API: скопируй "Project URL" и публичный "anon" ключ.
//   3. Вставь их ниже.
//
// anon-ключ ПУБЛИЧНЫЙ по дизайну — его не страшно держать в репозитории.
// Доступ ограничивает RLS-политика в Supabase (только чтение + вставка).
//
// Пока строки пустые — игра использует локальную таблицу (localStorage), как раньше.

const SUPABASE_URL = 'https://xfmernnuakzwqpvnttjn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_HgcwYQv6VSaWBgLTZ5DcKg_-5__ndpr';
