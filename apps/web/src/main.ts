import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { useAuth } from './auth';

const app = createApp(App);
app.use(router);
void useAuth().init().finally(() => app.mount('#app'));
