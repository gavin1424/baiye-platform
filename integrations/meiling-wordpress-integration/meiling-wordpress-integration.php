<?php
/**
 * Plugin Name: 美玲拼布｜LINE 與 AI 智能客服
 * Description: 載入美玲拼布 AI 客服、LINE 入口與正式線上預約頁。
 * Version: 1.1.0
 * Author: 創百業
 */

if (!defined('ABSPATH')) {
    exit;
}

const MEILING_LINE_URL = 'https://lin.ee/SdFAst4';
const MEILING_AI_WIDGET_URL = 'https://chuang-baiye-ai.baiye-platform.workers.dev/widgets/meiling-chat-widget.js';
const MEILING_BOOKING_WIDGET_URL = 'https://chuang-baiye-ai.baiye-platform.workers.dev/widgets/meiling-booking.js';
const MEILING_BOOKING_URL = 'https://meilingpatchwork.com/booking/';
const MEILING_LINE_QR_URL = 'https://meilingpatchwork.com/wp-content/themes/meiling-patchwork/assets/images/social/meiling-line-qr.jpg';

function meiling_customer_service_assets() {
    wp_enqueue_script('meiling-ai-chat-widget', MEILING_AI_WIDGET_URL, array(), '1.1.0', true);
    if (is_page('booking')) {
        wp_enqueue_script('meiling-booking-widget', MEILING_BOOKING_WIDGET_URL, array(), '1.1.0', true);
    }
    wp_register_style('meiling-customer-service', false, array(), '1.1.0');
    wp_enqueue_style('meiling-customer-service');
    wp_add_inline_style('meiling-customer-service', '
      .meiling-line-cta{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border-radius:999px;background:#06c755;color:#fff!important;text-decoration:none!important;font-weight:700;padding:.65rem 1rem;box-shadow:0 8px 24px rgba(6,199,85,.22)}
      .meiling-line-cta:hover{background:#05ad4b;color:#fff!important}
      .meiling-line-footer{margin:1rem 0;text-align:center}
      .meiling-line-mobile{display:none;position:fixed;left:12px;bottom:12px;z-index:2147482000}
      .meiling-contact-line{margin:2rem 0;padding:1.5rem;border:1px solid #ead8c8;border-radius:18px;background:#fff9ef;text-align:center}
      .meiling-contact-line img{display:block;width:min(220px,70vw);height:auto;margin:1rem auto;border-radius:12px}
      .meiling-booking-page{max-width:900px;margin:2rem auto;padding:1rem;color:#59463a}
      .mb-card{padding:clamp(1rem,4vw,2.2rem);border:1px solid #e5d6c6;border-radius:24px;background:#fffaf0;box-shadow:0 16px 45px rgba(104,76,55,.1)}
      .mb-eyebrow{color:#7c8b68;font-weight:800;letter-spacing:.08em}.mb-step{display:inline-block;padding:.3rem .65rem;border-radius:999px;background:#e9eee1;color:#5f704e;font-size:.8rem;font-weight:800}
      .mb-card h1{color:#6b4f3e}.mb-services,.mb-slots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;margin:1rem 0}.mb-service,.mb-slots button{display:grid;gap:.35rem;text-align:left;padding:1rem;border:1px solid #ddcbb8;border-radius:16px;background:#fff;color:#59463a;cursor:pointer}.mb-service:hover,.mb-slots button:hover{border-color:#94a57c;background:#f4f6ef}.mb-service span,.mb-service small,.mb-slots small{color:#79695d}.mb-input{width:100%;box-sizing:border-box;padding:.8rem;border:1px solid #d9c6b4;border-radius:10px;background:#fff;font-size:16px}.mb-card label{display:grid;gap:.4rem;margin:.8rem 0;font-weight:700}.mb-primary,.mb-secondary,.mb-danger,.mb-back{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:.7rem 1rem;border-radius:12px;border:0;text-decoration:none!important;font-weight:800;cursor:pointer}.mb-primary{background:#7c8b68;color:#fff!important}.mb-secondary{background:#f1e5d8;color:#654b3b!important}.mb-danger{background:#fff0ed;color:#9d3d32}.mb-back{padding-left:0;background:transparent;color:#795b47}.mb-actions{display:flex;flex-wrap:wrap;gap:.65rem;margin-top:1rem}.mb-message{margin:1rem 0;padding:1rem;border-radius:12px;background:#f1e5d8}.mb-message.error{background:#fff0ed;color:#8b3128}.mb-summary{display:grid;gap:.35rem;padding:1rem;border-radius:14px;background:#f2eee6}.mb-success{font-size:3rem;color:#7c8b68;text-align:center}.mb-loading{padding:1rem;color:#79695d}
      @media(max-width:782px){.meiling-line-mobile{display:inline-flex}.meiling-line-header{display:none!important}.meiling-booking-page{padding:.5rem}.mb-services,.mb-slots{grid-template-columns:1fr}.mb-actions{display:grid}.mb-actions>*{width:100%;box-sizing:border-box}.meiling-booking-page~.meiling-line-mobile{bottom:82px}}
    ');

    $line_url = wp_json_encode(MEILING_LINE_URL);
    $qr_url = wp_json_encode(MEILING_LINE_QR_URL);
    wp_add_inline_script('meiling-ai-chat-widget', "
      document.addEventListener('DOMContentLoaded', function () {
        const lineUrl = {$line_url};
        const qrUrl = {$qr_url};
        const makeLink = (className, text) => {
          const link = document.createElement('a');
          link.href = lineUrl;
          link.className = 'meiling-line-cta ' + className;
          link.textContent = text;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          return link;
        };
        const header = document.querySelector('.mpf-site-header, header');
        if (header && !header.querySelector('.meiling-line-header')) {
          const headerLine = makeLink('meiling-line-header', 'LINE 詢問');
          const courseCta = Array.from(header.querySelectorAll('a')).find(function (link) {
            return link.textContent.trim() === '課程洽詢';
          });
          if (courseCta && courseCta.parentNode) courseCta.parentNode.insertBefore(headerLine, courseCta);
          else header.appendChild(headerLine);
        }
        const footer = document.querySelector('footer');
        if (footer && !footer.querySelector('a[href=\"' + lineUrl + '\"]')) {
          const wrap = document.createElement('div');
          wrap.className = 'meiling-line-footer';
          wrap.appendChild(makeLink('', '加入 LINE 官方帳號'));
          footer.appendChild(wrap);
        }
        if (!document.querySelector('.meiling-line-mobile')) document.body.appendChild(makeLink('meiling-line-mobile', 'LINE 聯絡'));
        document.querySelectorAll('footer p').forEach(function (paragraph) {
          if (paragraph.textContent.includes('正式聯絡方式整理中') || paragraph.textContent.includes('線上表單尚在設定中')) {
            paragraph.textContent = '課程、作品、商品與客製需求，歡迎透過 LINE 聯絡。';
          }
        });
        if (/\\/contact\\/?$/.test(location.pathname)) {
          const main = document.querySelector('main');
          if (main) {
            main.innerHTML = '<section class=\"meiling-contact-line\" aria-label=\"美玲拼布 LINE 官方帳號\">'
              + '<p>報名／聯絡</p>'
              + '<h1>透過 LINE 聯絡美玲拼布</h1>'
              + '<p>課程、作品、商品與客製需求，歡迎直接加入官方帳號留言；訊息會確實送達店家。</p>'
              + '<a href=\"' + lineUrl + '\" target=\"_blank\" rel=\"noopener noreferrer\"><img src=\"' + qrUrl + '\" alt=\"美玲拼布 LINE 官方帳號 QR Code\"></a>'
              + '<p><a class=\"meiling-line-cta\" href=\"' + lineUrl + '\" target=\"_blank\" rel=\"noopener noreferrer\">加入 LINE 官方帳號</a></p>'
              + '<p>洽詢時可說明想了解的課程或作品，以及品項、用途、尺寸、數量與預算需求。</p>'
              + '</section>';
          }
        }
      });
    ");
}
add_action('wp_enqueue_scripts', 'meiling_customer_service_assets');

function meiling_booking_activate() {
    if (!get_page_by_path('booking')) {
        wp_insert_post(array('post_title' => '線上預約', 'post_name' => 'booking', 'post_status' => 'publish', 'post_type' => 'page', 'post_content' => '[meiling_booking]'));
    }
}
register_activation_hook(__FILE__, 'meiling_booking_activate');

function meiling_booking_ensure_page() {
    if (get_option('meiling_booking_schema_version') === '1.1.0') return;
    meiling_booking_activate();
    update_option('meiling_booking_schema_version', '1.1.0', false);
}
add_action('init', 'meiling_booking_ensure_page');

function meiling_booking_shortcode() {
    return '<main class="meiling-booking-page"><div data-meiling-booking><div class="mb-card"><p>正在載入線上預約…</p></div></div></main>';
}
add_shortcode('meiling_booking', 'meiling_booking_shortcode');

function meiling_courses_booking_cta($content) {
    if (!is_page('courses') || !in_the_loop() || !is_main_query()) return $content;
    return $content . '<p class="meiling-booking-cta"><a class="meiling-line-cta" href="' . esc_url(MEILING_BOOKING_URL) . '">立即預約課程／諮詢</a></p>';
}
add_filter('the_content', 'meiling_courses_booking_cta', 25);

function meiling_contact_line_section($content) {
    if (!is_page('contact') || !in_the_loop() || !is_main_query()) {
        return $content;
    }

    $line_url = esc_url(MEILING_LINE_URL);
    $qr_url = esc_url(MEILING_LINE_QR_URL);
    return '<section class="meiling-contact-line" aria-label="美玲拼布 LINE 官方帳號">'
        . '<h2>加入美玲拼布 LINE 官方帳號</h2>'
        . '<p>課程、作品、商品與客製需求，歡迎透過 LINE 留言詢問。</p>'
        . '<a href="' . $line_url . '" target="_blank" rel="noopener noreferrer"><img src="' . $qr_url . '" alt="美玲拼布 LINE 官方帳號 QR Code" loading="lazy"></a>'
        . '<p><a class="meiling-line-cta" href="' . $line_url . '" target="_blank" rel="noopener noreferrer">加入 LINE 官方帳號</a></p>'
        . '<p>為了讓訊息確實送達，目前請直接使用 LINE 聯絡；本站不顯示尚未串接寄送功能的表單。</p>'
        . '</section>';
}
add_filter('the_content', 'meiling_contact_line_section', 20);
