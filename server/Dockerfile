FROM php:8.3-apache
RUN docker-php-ext-install pdo pdo_mysql
RUN a2enmod rewrite headers
WORKDIR /var/www/html
COPY . /var/www/html
EXPOSE 80
