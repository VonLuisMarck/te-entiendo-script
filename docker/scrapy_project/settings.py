# -*- coding: utf-8 -*-
"""
Scrapy settings for inmofinder project
"""

BOT_NAME = 'inmofinder'

SPIDER_MODULES = ['scrapy_project.spiders']
NEWSPIDER_MODULE = 'scrapy_project.spiders'

# Obey robots.txt rules
ROBOTSTXT_OBEY = False

# Configure maximum concurrent requests
CONCURRENT_REQUESTS = 2

# Configure a delay for requests
DOWNLOAD_DELAY = 1.5
RANDOMIZE_DOWNLOAD_DELAY = True

# Disable cookies
COOKIES_ENABLED = True

# Enable retry middleware
RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [429, 500, 502, 503, 504]

# Enable autothrottle
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1
AUTOTHROTTLE_MAX_DELAY = 10
AUTOTHROTTLE_TARGET_CONCURRENCY = 1.0

# Item pipelines
ITEM_PIPELINES = {
    'scrapy_project.pipelines.DataValidationPipeline': 100,
    'scrapy_project.pipelines.DataCleaningPipeline': 200,
    'scrapy_project.pipelines.PropertyTransformPipeline': 300,
}

# Set logging level
LOG_LEVEL = 'INFO'
