<?php
/**
 * JetBooking Integration for Persian Calendar
 *
 * Provides Persian/Jalali calendar support for Crocoblock's JetBooking plugin.
 * Handles both frontend (date range picker) and backend (Vue.js datepicker,
 * calendar, and timeline) date components.
 *
 * @package PERSCA
 * @since 1.3.3
 */

if (!defined('ABSPATH')) {
    exit;
}

// Enqueue integration assets on both frontend and admin
add_action('admin_enqueue_scripts', 'persca_jet_booking_enqueue_assets', 20);
add_action('wp_enqueue_scripts', 'persca_jet_booking_enqueue_assets', 20);

// Inject our script as a dependency of JetBooking scripts so it loads automatically
add_action('wp_default_scripts', 'persca_jet_booking_add_dependencies', 100);
add_action('admin_enqueue_scripts', 'persca_jet_booking_add_dependencies', 100);
add_action('wp_enqueue_scripts', 'persca_jet_booking_add_dependencies', 100);

/**
 * Enqueue Persian Calendar integration scripts and styles for JetBooking.
 */
function persca_jet_booking_enqueue_assets() {
    // Only load if JetBooking is active
    if (!class_exists('JET_ABAF\\Plugin') && !defined('JET_ABAF_VERSION')) {
        return;
    }

    // Enqueue base Persian calendar script (date converter + calendar UI)
    wp_enqueue_script(
        'persian-calendar-main',
        PERSCA_PLUGIN_URL . 'assets/js/persian-calendar.js',
        array('jquery'),
        PERSCA_PLUGIN_VERSION,
        true
    );

    // Enqueue the main frontend stylesheet for the calendar (range highlights and sizing variables)
    wp_enqueue_style(
        'persian-calendar-front',
        PERSCA_PLUGIN_URL . 'assets/css/persian-calendar-front.css',
        array(),
        PERSCA_PLUGIN_VERSION
    );

    // Enqueue Gutenberg calendar styles for the custom datepicker popup
    wp_enqueue_style(
        'persian-calendar-gutenberg-styles',
        PERSCA_PLUGIN_URL . 'assets/css/gutenberg-calendar.css',
        array(),
        PERSCA_PLUGIN_VERSION
    );

    // Enqueue shared Jet integration styles
    wp_enqueue_style(
        'persca-integrate-jet-styles',
        PERSCA_PLUGIN_URL . 'assets/css/integrate-jet.css',
        array('persian-calendar-gutenberg-styles'),
        PERSCA_PLUGIN_VERSION
    );



    // Enqueue the main JetBooking integration script
    wp_enqueue_script(
        'persca-integrate-jet-booking',
        PERSCA_PLUGIN_URL . 'assets/js/integrate-jet-booking.js',
        array('jquery', 'persian-calendar-main'),
        PERSCA_PLUGIN_VERSION,
        true
    );
}

/**
 * Add our integration script as a dependency to JetBooking scripts
 * so it loads before JetBooking initialises its datepickers.
 */
function persca_jet_booking_add_dependencies() {
    global $wp_scripts;
    if (!$wp_scripts) {
        return;
    }

    // 1. Force the original date range picker scripts to depend on our integration script
    // so our script executes BEFORE the original library and its inline init script execute.
    $original_picker_scripts = array('jquery-date-range-picker', 'jquery-date-range-picker-js');
    foreach ($original_picker_scripts as $handle) {
        if (isset($wp_scripts->registered[$handle])) {
            $deps = &$wp_scripts->registered[$handle]->deps;
            if (!in_array('persca-integrate-jet-booking', $deps, true)) {
                $deps[] = 'persca-integrate-jet-booking';
            }
        }
    }

    // 2. Ensure JetBooking init scripts load AFTER our integration script
    $target_scripts = array(
        // Frontend: date range picker initialisation
        'jet-booking-init',
        'jet-abaf-booking-init',
        // Backend: bookings page (timeline, filters, calendar)
        'jet-abaf-bookings-page',
        'jet-abaf-bookings',
        // Backend: settings page (schedule manager with vuejs-datepicker)
        'jet-abaf-settings-page',
        'jet-abaf-schedule-manager',
        'jet-abaf-meta-extras',
        // Backend: post meta (price seasons with vuejs-datepicker)
        'jet-abaf-post-meta-price',
        'jet-abaf-post-meta-configuration',
        // Backend: calendars page
        'jet-abaf-calendars-page',
    );

    foreach ($target_scripts as $handle) {
        if (isset($wp_scripts->registered[$handle])) {
            $deps = &$wp_scripts->registered[$handle]->deps;
            if (!in_array('persca-integrate-jet-booking', $deps, true)) {
                $deps[] = 'persca-integrate-jet-booking';
            }
        }
    }
}
