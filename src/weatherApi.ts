import axios, { AxiosInstance, AxiosError } from 'axios';

interface Coordinates {
  lat: number;
  lon: number;
  name: string;
  country: string;
}

interface WeatherData {
  temp: number;
  tempMin: number;
  tempMax: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDeg: number;
  clouds: number;
  visibility: number;
  description: string;
  icon: string;
  iconUrl: string;
  cityName: string;
  country: string;
  sunrise: Date;
  sunset: Date;
  dt: Date;
}

interface HourlyWeatherData {
  dt: Date;
  temp: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDeg: number;
  clouds: number;
  description: string;
  icon: string;
  iconUrl: string;
}

interface DailyForecast {
  date: Date;
  tempMin: number;
  tempMax: number;
  tempAvg: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  description: string;
  icon: string;
  iconUrl: string;
  hourly: HourlyWeatherData[];
}

interface ForecastData {
  city: string;
  country: string;
  forecast: DailyForecast[];
}

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  current_weather?: {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    time: string;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    relative_humidity_2m: number[];
    pressure_msl: number[];
    cloudcover: number[];
    visibility: number[];
    windspeed_10m: number[];
    winddirection_10m: number[];
    weathercode: number[];
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    weathercode: number[];
  };
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

type Units = 'metric' | 'imperial';
type Language = 'ru' | 'en' | string;

class OpenMeteoAPI {
  private baseURL: string;
  private geocodingURL: string;
  private axios: AxiosInstance;

  constructor() {
    this.baseURL = 'https://api.open-meteo.com/v1';
    this.geocodingURL = 'https://nominatim.openstreetmap.org';
    this.axios = axios.create({
      timeout: 10000,
    });
  }

  async getWeatherAndForecast(
    lat: number,
    lon: number,
    units: Units = 'metric'
  ): Promise<{ current: WeatherData; forecast: ForecastData }> {
    try {
      const temperatureUnit = units === 'imperial' ? 'fahrenheit' : 'celsius';
      const windspeedUnit = units === 'imperial' ? 'mph' : 'ms';

      const response = await this.axios.get<OpenMeteoResponse>(
        `${this.baseURL}/forecast`,
        {
          params: {
            latitude: lat,
            longitude: lon,
            current_weather: true,
            hourly: 'temperature_2m,apparent_temperature,relative_humidity_2m,pressure_msl,cloudcover,visibility,windspeed_10m,winddirection_10m,weathercode',
            daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset,weathercode',
            temperature_unit: temperatureUnit,
            windspeed_unit: windspeedUnit,
            timezone: 'auto'
          }
        }
      );

      const locationInfo = await this.getCityNameByCoords(lat, lon);

      return {
        current: this.formatCurrentWeather(response.data, locationInfo),
        forecast: this.formatForecast(response.data, locationInfo)
      };
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async getWeatherByCity(
    cityName: string,
    units: Units = 'metric'
  ): Promise<{ current: WeatherData; forecast: ForecastData }> {
    try {
      const coords = await this.getCoordinatesByCity(cityName);
      if (!coords) {
        throw new Error('Город не найден');
      }

      return await this.getWeatherAndForecast(coords.lat, coords.lon, units);
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  async getCoordinatesByCity(cityName: string): Promise<Coordinates | null> {
    try {
      const response = await this.axios.get<NominatimResponse[]>(
        `${this.geocodingURL}/search`,
        {
          params: {
            q: cityName,
            format: 'json',
            limit: 1,
            'accept-language': 'ru'
          },
          headers: {
            'User-Agent': 'WeatherApp/1.0'
          }
        }
      );

      if (response.data.length === 0) {
        return null;
      }

      const data = response.data[0];
      return {
        lat: parseFloat(data.lat),
        lon: parseFloat(data.lon),
        name: data.address?.city || data.address?.town || data.address?.village || cityName,
        country: data.address?.country_code?.toUpperCase() || ''
      };
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  private async getCityNameByCoords(lat: number, lon: number): Promise<{ city: string; country: string }> {
    try {
      const response = await this.axios.get<NominatimResponse>(
        `${this.geocodingURL}/reverse`,
        {
          params: {
            lat,
            lon,
            format: 'json',
            'accept-language': 'ru'
          },
          headers: {
            'User-Agent': 'WeatherApp/1.0'
          }
        }
      );

      return {
        city: response.data.address?.city || response.data.address?.town || response.data.address?.village || 'Unknown',
        country: response.data.address?.country_code?.toUpperCase() || ''
      };
    } catch (error) {
      return { city: 'Unknown', country: '' };
    }
  }

  private formatCurrentWeather(data: OpenMeteoResponse, location: { city: string; country: string }): WeatherData {
    const current = data.current_weather!;
    const currentHour = new Date().getHours();
    const todayIndex = 0;

    return {
      temp: Math.round(current.temperature),
      tempMin: Math.round(Math.min(...data.daily!.temperature_2m_min)),
      tempMax: Math.round(Math.max(...data.daily!.temperature_2m_max)),
      feelsLike: Math.round(data.hourly!.apparent_temperature[currentHour]),
      humidity: Math.round(data.hourly!.relative_humidity_2m[currentHour]),
      pressure: Math.round(data.hourly!.pressure_msl[currentHour] * 0.750062),
      windSpeed: current.windspeed,
      windDeg: current.winddirection,
      clouds: Math.round(data.hourly!.cloudcover[currentHour]),
      visibility: Math.round(data.hourly!.visibility[currentHour]),
      description: this.getWeatherDescription(current.weathercode),
      icon: this.getWeatherIcon(current.weathercode),
      iconUrl: this.getWeatherIconUrl(current.weathercode),
      cityName: location.city,
      country: location.country,
      sunrise: new Date(data.daily!.sunrise[todayIndex]),
      sunset: new Date(data.daily!.sunset[todayIndex]),
      dt: new Date(current.time)
    };
  }

  private formatForecast(data: OpenMeteoResponse, location: { city: string; country: string }): ForecastData {
    const dailyForecasts: DailyForecast[] = [];

    for (let i = 0; i < Math.min(5, data.daily!.time.length); i++) {
      const date = new Date(data.daily!.time[i]);
      const hourlyData: HourlyWeatherData[] = [];

      data.hourly!.time.forEach((time, index) => {
        const hourDate = new Date(time);
        if (hourDate.toDateString() === date.toDateString()) {
          hourlyData.push({
            dt: hourDate,
            temp: Math.round(data.hourly!.temperature_2m[index]),
            feelsLike: Math.round(data.hourly!.apparent_temperature[index]),
            humidity: Math.round(data.hourly!.relative_humidity_2m[index]),
            pressure: Math.round(data.hourly!.pressure_msl[index] * 0.750062),
            windSpeed: data.hourly!.windspeed_10m[index],
            windDeg: data.hourly!.winddirection_10m[index],
            clouds: Math.round(data.hourly!.cloudcover[index]),
            description: this.getWeatherDescription(data.hourly!.weathercode[index]),
            icon: this.getWeatherIcon(data.hourly!.weathercode[index]),
            iconUrl: this.getWeatherIconUrl(data.hourly!.weathercode[index])
          });
        }
      });

      const avgHumidity = hourlyData.reduce((sum, h) => sum + h.humidity, 0) / hourlyData.length;
      const avgPressure = hourlyData.reduce((sum, h) => sum + h.pressure, 0) / hourlyData.length;
      const avgWindSpeed = hourlyData.reduce((sum, h) => sum + h.windSpeed, 0) / hourlyData.length;

      dailyForecasts.push({
        date,
        tempMin: Math.round(data.daily!.temperature_2m_min[i]),
        tempMax: Math.round(data.daily!.temperature_2m_max[i]),
        tempAvg: Math.round((data.daily!.temperature_2m_min[i] + data.daily!.temperature_2m_max[i]) / 2),
        humidity: Math.round(avgHumidity),
        pressure: Math.round(avgPressure),
        windSpeed: Math.round(avgWindSpeed * 10) / 10,
        description: this.getWeatherDescription(data.daily!.weathercode[i]),
        icon: this.getWeatherIcon(data.daily!.weathercode[i]),
        iconUrl: this.getWeatherIconUrl(data.daily!.weathercode[i]),
        hourly: hourlyData
      });
    }

    return {
      city: location.city,
      country: location.country,
      forecast: dailyForecasts
    };
  }

  private getWeatherDescription(code: number): string {
    const weatherCodes: { [key: number]: string } = {
      0: 'Ясно',
      1: 'Преимущественно ясно',
      2: 'Переменная облачность',
      3: 'Пасмурно',
      45: 'Туман',
      48: 'Изморозь',
      51: 'Легкая морось',
      53: 'Умеренная морось',
      55: 'Сильная морось',
      61: 'Легкий дождь',
      63: 'Умеренный дождь',
      65: 'Сильный дождь',
      71: 'Легкий снег',
      73: 'Умеренный снег',
      75: 'Сильный снег',
      77: 'Снежная крупа',
      80: 'Легкие ливни',
      81: 'Умеренные ливни',
      82: 'Сильные ливни',
      95: 'Гроза',
      96: 'Гроза с градом',
      99: 'Сильная гроза с градом'
    };

    return weatherCodes[code] || 'Неизвестно';
  }

  private getWeatherIcon(code: number): string {
    const iconMap: { [key: number]: string } = {
      0: '01d', 1: '02d', 2: '03d', 3: '04d',
      45: '50d', 48: '50d',
      51: '09d', 53: '09d', 55: '09d',
      61: '10d', 63: '10d', 65: '10d',
      71: '13d', 73: '13d', 75: '13d', 77: '13d',
      80: '09d', 81: '09d', 82: '09d',
      95: '11d', 96: '11d', 99: '11d'
    };

    return iconMap[code] || '01d';
  }

  private getWeatherIconUrl(code: number): string {
    const icon = this.getWeatherIcon(code);
    return `https://openweathermap.org/img/wn/${icon}@2x.png`;
  }

  private handleError(error: AxiosError): Error {
    if (error.response) {
      switch (error.response.status) {
        case 404:
          return new Error('Данные не найдены');
        case 429:
          return new Error('Превышен лимит запросов');
        default:
          return new Error('Ошибка сервера');
      }
    } else if (error.request) {
      return new Error('Нет соединения с сервером');
    } else {
      return new Error(error.message || 'Неизвестная ошибка');
    }
  }

  static getWindDirection(deg: number): string {
    const directions = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
    const index = Math.round(deg / 45) % 8;
    return directions[index];
  }

  static getAlternativeIcon(iconCode: string): string {
    const iconMap: { [key: string]: string } = {
      '01d': '☀️', '01n': '🌙',
      '02d': '⛅', '02n': '☁️',
      '03d': '☁️', '03n': '☁️',
      '04d': '☁️', '04n': '☁️',
      '09d': '🌧️', '09n': '🌧️',
      '10d': '🌦️', '10n': '🌧️',
      '11d': '⛈️', '11n': '⛈️',
      '13d': '❄️', '13n': '❄️',
      '50d': '🌫️', '50n': '🌫️'
    };
    return iconMap[iconCode] || '❓';
  }
}

export default OpenMeteoAPI;
export type {
  WeatherData,
  ForecastData,
  DailyForecast,
  HourlyWeatherData,
  Coordinates,
  Units,
  Language
};
