# Controle da Frota — imagem para o Render (PHP + Apache, banco no PostgreSQL/Neon)
FROM php:8.3-apache

RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq-dev \
 && docker-php-ext-install pdo_pgsql \
 && rm -rf /var/lib/apt/lists/*

# .htaccess do sistema (bloqueia src/, dados/ e uploads/) precisa valer
RUN a2enmod headers \
 && sed -i 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

RUN { \
      echo 'date.timezone = America/Sao_Paulo'; \
      echo 'upload_max_filesize = 10M'; \
      echo 'post_max_size = 12M'; \
      echo 'expose_php = Off'; \
    } > /usr/local/etc/php/conf.d/frota.ini

COPY frota/ /var/www/html/
RUN chown -R www-data:www-data /var/www/html

# O Render informa a porta na variável PORT
CMD sed -i "s/Listen 80\$/Listen ${PORT:-80}/" /etc/apache2/ports.conf \
 && sed -i "s/:80>/:${PORT:-80}>/" /etc/apache2/sites-enabled/000-default.conf \
 && apache2-foreground
