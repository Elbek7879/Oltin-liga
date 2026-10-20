-- Liga o'yinlari 2 × 20 daqiqa: yangi mavsumlar uchun standart bo'lim davomiyligi 20 daqiqa.
-- Mavjud mavsumlarning qiymati o'zgarmaydi (Sozlamalar bo'limida tahrirlanadi).
alter table seasons alter column half_minutes set default 20;
