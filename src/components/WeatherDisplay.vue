<template>
  <div class="weather-widget dark">
    <div class="search-container">
      <input
          v-model="searchCity"
          @keyup.enter="searchWeather"
          type="text"
          placeholder="Введите название города..."
          class="search-input"
      />
      <button @click="searchWeather" class="search-button" :disabled="loading">
        <span v-if="!loading">🔍</span>
        <span v-else class="loader"></span>
      </button>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="currentWeather && !loading" class="current-weather">
      <div class="weather-header">
        <h2 class="city-name">
          {{ currentWeather.cityName }}, {{ currentWeather.country }}
        </h2>
        <p class="date">{{ formatDate(currentWeather.dt) }}</p>
      </div>

      <div class="weather-main">
        <div class="temperature-container">
          <img
              :src="currentWeather.iconUrl"
              :alt="currentWeather.description"
              class="weather-icon"
              @error="handleIconError($event, currentWeather.icon)"
          />
          <div class="temperature">{{ currentWeather.temp }}°</div>
        </div>
        <p class="description">{{ currentWeather.description }}</p>
        <p class="feels-like">Ощущается как {{ currentWeather.feelsLike }}°</p>
      </div>

      <div class="weather-details">
        <div class="detail-item">
          <span class="detail-icon">💧</span>
          <span class="detail-label">Влажность</span>
          <span class="detail-value">{{ currentWeather.humidity }}%</span>
        </div>
        <div class="detail-item">
          <span class="detail-icon">🌡️</span>
          <span class="detail-label">Давление</span>
          <span class="detail-value">{{ currentWeather.pressure }} мм</span>
        </div>
        <div class="detail-item">
          <span class="detail-icon">💨</span>
          <span class="detail-label">Ветер</span>
          <span class="detail-value">
            {{ currentWeather.windSpeed }} м/с
            {{ getWindDirection(currentWeather.windDeg) }}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-icon">👁️</span>
          <span class="detail-label">Видимость</span>
          <span class="detail-value">
            {{ (currentWeather.visibility / 1000).toFixed(1) }} км
          </span>
        </div>
      </div>

      <div class="sun-times">
        <div class="sun-item">
          <span class="sun-icon">🌅</span>
          <span>Восход: {{ formatTime(currentWeather.sunrise) }}</span>
        </div>
        <div class="sun-item">
          <span class="sun-icon">🌇</span>
          <span>Закат: {{ formatTime(currentWeather.sunset) }}</span>
        </div>
      </div>
    </div>

    <div v-if="currentWeather && !loading" class="forecast-toggle">
      <button @click="showForecast = !showForecast" class="toggle-button">
        {{ showForecast ? "Скрыть прогноз" : "Показать прогноз на 5 дней" }}
      </button>
    </div>

    <div
        v-if="forecast && showForecast && !loading"
        class="forecast-container"
    >
      <h3 class="forecast-title">Прогноз на 5 дней</h3>
      <div class="forecast-list">
        <div
            v-for="day in forecast.forecast"
            :key="day.date.toISOString()"
            class="forecast-day"
            @click="selectedDay = selectedDay === day ? null : day"
            :class="{ selected: selectedDay === day }"
        >
          <p class="day-name">{{ formatDayName(day.date) }}</p>
          <img
              :src="day.iconUrl"
              :alt="day.description"
              class="forecast-icon"
              @error="handleIconError($event, day.icon)"
          />
          <p class="day-temp">{{ day.tempMax }}° / {{ day.tempMin }}°</p>
          <p class="day-description">{{ day.description }}</p>
        </div>
      </div>

      <div v-if="selectedDay" class="hourly-forecast">
        <h4 class="hourly-title">
          Почасовой прогноз на {{ formatDate(selectedDay.date) }}
        </h4>
        <div class="hourly-list">
          <div
              v-for="hour in selectedDay.hourly"
              :key="hour.dt.toISOString()"
              class="hourly-item"
          >
            <p class="hour-time">{{ formatTime(hour.dt) }}</p>
            <img
                :src="hour.iconUrl"
                :alt="hour.description"
                class="hourly-icon"
                @error="handleIconError($event, hour.icon)"
            />
            <p class="hour-temp">{{ hour.temp }}°</p>
            <p class="hour-desc">{{ hour.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Загрузка погоды...</p>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import OpenMeteoAPI from "../weatherApi.ts";

export default {
  name: "WeatherDisplay",
  props: {
    defaultCity: {
      type: String,
      default: "Москва",
    },
    units: {
      type: String,
      default: "metric",
    },
  },
  setup(props) {
    const weatherApi = new OpenMeteoAPI(); // API-ключ не нужен
    const currentWeather = ref(null);
    const forecast = ref(null);
    const loading = ref(false);
    const error = ref(null);
    const searchCity = ref(props.defaultCity);

    const showForecast = ref(true);
    const selectedDay = ref(null);

    const searchWeather = async () => {
      if (!searchCity.value.trim()) {
        error.value = "Введите название города";
        return;
      }

      loading.value = true;
      error.value = null;
      selectedDay.value = null;

      try {
        const weatherData = await weatherApi.getWeatherByCity(
            searchCity.value,
            props.units
        );

        currentWeather.value = weatherData.current;
        forecast.value = weatherData.forecast;

        const todayStr = new Date().toDateString();
        selectedDay.value =
            forecast.value?.forecast.find(
                (d) => d.date.toDateString() === todayStr
            ) || null;
      } catch (err) {
        error.value = err.message || "Произошла ошибка при загрузке погоды";
        currentWeather.value = null;
        forecast.value = null;
      } finally {
        loading.value = false;
      }
    };

    const formatDate = (date) => {
      return new Intl.DateTimeFormat("ru-RU", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
    };

    const formatDayName = (date) => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.toDateString() === today.toDateString()) {
        return "Сегодня";
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return "Завтра";
      }

      return new Intl.DateTimeFormat("ru-RU", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(date);
    };

    const formatTime = (date) => {
      return new Intl.DateTimeFormat("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    };

    const getWindDirection = (deg) => {
      return OpenMeteoAPI.getWindDirection(deg);
    };

    const handleIconError = (event, iconCode) => {
      const emoji = OpenMeteoAPI.getAlternativeIcon(iconCode);
      event.target.style.display = "none";
      event.target.parentElement.insertAdjacentHTML(
          "beforeend",
          `<span class="emoji-icon">${emoji}</span>`
      );
    };

    onMounted(() => {
      searchWeather();
    });

    return {
      currentWeather,
      forecast,
      loading,
      error,
      searchCity,
      showForecast,
      selectedDay,
      searchWeather,
      formatDate,
      formatDayName,
      formatTime,
      getWindDirection,
      handleIconError,
    };
  },
};
</script>

<style scoped>
:root {
  --color-bg: #121212;
  --color-card: #1e1e1e;
  --color-accent: #4fc3f7;
  --color-accent-hover: #29b6f6;
  --color-text-primary: #e0e0e0;
  --color-text-secondary: #a0a0a0;
  --color-error-bg: #4e0404;
  --color-error-text: #ffb3b3;
}

.dark {
  background: var(--color-bg);
  color: var(--color-text-primary);
}

.weather-widget {
  max-width: 600px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.search-container {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  padding: 14px;
}

.search-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #333;
  border-radius: 8px;
  font-size: 16px;
  background: var(--color-card);
  color: var(--color-text-primary);
  transition: border-color 0.3s;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.search-button {
  padding: 12px 12px;
  background: var(--color-accent);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  transition: background 0.3s;
}

.search-button:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.search-button:disabled {
  background: #555;
  cursor: not-allowed;
}

.error-message {
  background: var(--color-error-bg);
  color: var(--color-error-text);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.current-weather {
  background: var(--color-card);
  border-radius: 16px;
  padding: 24px;
}

.weather-header {
  text-align: center;
  margin-bottom: 20px;
}

.city-name {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.date {
  margin: 5px 0 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.weather-main {
  text-align: center;
  margin-bottom: 30px;
}

.temperature-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.weather-icon {
  width: 100px;
  height: 100px;
}

.emoji-icon {
  font-size: 80px;
  line-height: 1;
}

.temperature {
  font-size: 64px;
  font-weight: 300;
}

.description {
  font-size: 20px;
  color: var(--color-text-secondary);
  margin: 10px 0;
  text-transform: capitalize;
}

.feels-like {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.weather-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.detail-item {
  background: #2a2a2a;
  padding: 16px;
  border-radius: 12px;
  text-align: center;
}

.detail-icon {
  font-size: 24px;
  display: block;
  margin-bottom: 8px;
}

.detail-label {
  display: block;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.detail-value {
  display: block;
  font-size: 16px;
  font-weight: 600;
}

.sun-times {
  display: flex;
  justify-content: space-around;
  padding: 16px;
  background: #263238;
  border-radius: 12px;
}

.sun-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sun-icon {
  font-size: 20px;
}

.forecast-toggle {
  margin: 20px 0;
  text-align: center;
}

.toggle-button {
  padding: 10px 20px;
  background: transparent;
  border: 2px solid var(--color-accent);
  border-radius: 8px;
  color: var(--color-accent);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.toggle-button:hover {
  background: var(--color-accent);
  color: #fff;
}

.forecast-container {
  margin-top: 20px;
}

.forecast-title {
  font-size: 20px;
  margin-bottom: 16px;
  text-align: center;
  color: var(--color-text-primary);
}

.forecast-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  padding-left: 4px;
  padding-right: 4px;
  margin-bottom: 4px;
}

.forecast-day {
  background: #1e1e1e;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
  margin-left: 4px;
  margin-right: 4px;
}

.forecast-day:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.8);
}

.forecast-day.selected {
  background: #3f5a84;
  border: 2px solid var(--color-accent);
}

.day-name {
  font-weight: 600;
  margin: 0 0 8px;
}

.forecast-icon {
  width: 50px;
  height: 50px;
}

.day-temp {
  font-size: 16px;
  font-weight: 600;
  margin: 8px 0 4px;
}

.day-description {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.hourly-forecast {
  margin-top: 20px;
  background: var(--color-card);
  border-radius: 12px;
  padding: 20px;
}

.hourly-title {
  font-size: 16px;
  margin-bottom: 16px;
}

.hourly-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 12px;
}

.hourly-item {
  text-align: center;
  padding: 12px 8px;
  background: #2a2a2a;
  border-radius: 8px;
}

.hour-time {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px;
}

.hourly-icon {
  width: 40px;
  height: 40px;
}

.hour-temp {
  font-size: 16px;
  font-weight: 600;
  margin: 8px 0 4px;
}

.hour-desc {
  font-size: 11px;
  color: var(--color-text-secondary);
  text-transform: capitalize;
}

.loading-container {
  text-align: center;
  padding: 40px;
}

.loading-spinner,
.loader {
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #333;
  border-top: 4px solid var(--color-accent);
  margin: 0 auto 16px;
}

.loader {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #333;
  border-top: 2px solid #fff;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 600px) {
  .weather-details {
    grid-template-columns: repeat(2, 1fr);
  }

  .forecast-list {
    display: flex;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .forecast-day {
    min-width: 120px;
    flex: 0 0 auto;
  }

  .hourly-list {
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  }

  .temperature {
    font-size: 48px;
  }

  .weather-icon {
    width: 80px;
    height: 80px;
  }
}
</style>
