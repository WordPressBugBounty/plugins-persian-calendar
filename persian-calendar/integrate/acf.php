<?php
/**
 * Advanced Custom Fields (ACF) Integration for Persian Calendar
 *
 * Provides Persian/Jalali calendar support for ACF Date Picker, Date Time Picker,
 * and Time Picker fields while ensuring pure Gregorian dates are strictly saved
 * in the database.
 *
 * @package PersianCalendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/* =============================================================================
 * ASSETS & DEPENDENCIES
 * ========================================================================== */

add_action('admin_enqueue_scripts', 'persca_acf_enqueue_assets', 20);
add_action('wp_enqueue_scripts', 'persca_acf_enqueue_assets', 20);
add_action('enqueue_block_editor_assets', 'persca_acf_enqueue_assets', 20);
add_action('acf/input/admin_enqueue_scripts', 'persca_acf_enqueue_assets', 20);

// Inject our integration script handle into ACF script handles so it executes early
add_action('wp_default_scripts', 'persca_acf_add_dependencies', 100);
add_action('admin_enqueue_scripts', 'persca_acf_add_dependencies', 100);
add_action('wp_enqueue_scripts', 'persca_acf_add_dependencies', 100);
add_action('enqueue_block_editor_assets', 'persca_acf_add_dependencies', 100);

/**
 * Enqueue scripts and styles for ACF Persian calendar integration.
 */
function persca_acf_enqueue_assets(): void
{
    if (!persca_is_jalali_enabled() || !(class_exists('ACF') || class_exists('acf') || function_exists('acf'))) {
        return;
    }

    // Shared Jalali core script + popup styles.
    persca_enqueue_core_assets();

    // Enqueue ACF integration overrides
    wp_enqueue_script(
        'persca-integrate-acf',
        PERSCA_PLUGIN_URL . 'assets/js/integrate-acf.js',
        array('jquery', 'jquery-ui-datepicker', 'persian-calendar-main'),
        PERSCA_PLUGIN_VERSION,
        true
    );
}

/**
 * Add persca-integrate-acf as a dependency to ACF scripts.
 */
function persca_acf_add_dependencies(): void
{
    if (!persca_is_jalali_enabled() || !(class_exists('ACF') || class_exists('acf') || function_exists('acf'))) {
        return;
    }

    persca_inject_dependency(
        array(
            'acf-input',
            'acf-field-group',
        ),
        'persca-integrate-acf'
    );
}

/* =============================================================================
 * MACHINE FORMAT & DATABASE GREGORIAN SANITIZATION
 * ========================================================================== */

/**
 * Ensure 'Ymd' is registered as a machine format so ACF's internal hidden value
 * generation ($hidden_value = acf_format_date($val, 'Ymd')) is never converted to Jalali.
 *
 * @param string[] $formats List of machine date formats.
 * @return string[]
 */
function persca_acf_register_machine_formats(array $formats): array
{
    if (!in_array('Ymd', $formats, true)) {
        $formats[] = 'Ymd';
    }
    if (!in_array('YmdHis', $formats, true)) {
        $formats[] = 'YmdHis';
    }
    return $formats;
}
add_filter('persca_machine_date_formats', 'persca_acf_register_machine_formats');

/**
 * Guarantee strictly Gregorian 'Ymd' (e.g. 20260907) in database for date_picker fields.
 * Converts any dashes or accidental Jalali input to pure Gregorian Ymd.
 *
 * @param mixed $value
 * @param mixed $post_id
 * @param array $field
 * @return mixed
 */
function persca_acf_sanitize_date_picker_value($value, $post_id = 0, $field = null)
{
    if (empty($value) || !is_string($value)) {
        return $value;
    }

    $value = trim($value);

    // 1. Format: YYYY-MM-DD
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m)) {
        $y = (int) $m[1];
        $mo = (int) $m[2];
        $d = (int) $m[3];
        if ($y >= 1300 && $y <= 1500) {
            $conv = persca_get_converter();
            $g = $conv->jalali_to_gregorian($y, $mo, $d);
            return sprintf('%04d%02d%02d', $g['y'], $g['m'], $g['d']);
        }
        return sprintf('%04d%02d%02d', $y, $mo, $d);
    }

    // 2. Format: YYYY/MM/DD
    if (preg_match('/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/', $value, $m)) {
        $y = (int) $m[1];
        $mo = (int) $m[2];
        $d = (int) $m[3];
        if ($y >= 1300 && $y <= 1500) {
            $conv = persca_get_converter();
            $g = $conv->jalali_to_gregorian($y, $mo, $d);
            return sprintf('%04d%02d%02d', $g['y'], $g['m'], $g['d']);
        }
        return sprintf('%04d%02d%02d', $y, $mo, $d);
    }

    // 3. Format: 8-digit Ymd
    if (preg_match('/^(\d{4})(\d{2})(\d{2})$/', $value, $m)) {
        $y = (int) $m[1];
        $mo = (int) $m[2];
        $d = (int) $m[3];
        if ($y >= 1300 && $y <= 1500) {
            $conv = persca_get_converter();
            $g = $conv->jalali_to_gregorian($y, $mo, $d);
            return sprintf('%04d%02d%02d', $g['y'], $g['m'], $g['d']);
        }
        return $value;
    }

    return $value;
}
add_filter('acf/update_value/type=date_picker', 'persca_acf_sanitize_date_picker_value', 10, 3);

/**
 * Guarantee strictly Gregorian 'Y-m-d H:i:s' in database for date_time_picker fields.
 *
 * @param mixed $value
 * @param mixed $post_id
 * @param array $field
 * @return mixed
 */
function persca_acf_sanitize_date_time_picker_value($value, $post_id = 0, $field = null)
{
    if (empty($value) || !is_string($value)) {
        return $value;
    }

    $value = trim($value);

    // Format: YYYY-MM-DD HH:mm:ss or YYYY/MM/DD HH:mm:ss
    if (preg_match('/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/', $value, $m)) {
        $y = (int) $m[1];
        $mo = (int) $m[2];
        $d = (int) $m[3];
        $hh = (int) $m[4];
        $mi = (int) $m[5];
        $ss = isset($m[6]) ? (int) $m[6] : 0;

        if ($y >= 1300 && $y <= 1500) {
            $conv = persca_get_converter();
            $g = $conv->jalali_to_gregorian($y, $mo, $d);
            return sprintf('%04d-%02d-%02d %02d:%02d:%02d', $g['y'], $g['m'], $g['d'], $hh, $mi, $ss);
        }

        return sprintf('%04d-%02d-%02d %02d:%02d:%02d', $y, $mo, $d, $hh, $mi, $ss);
    }

    return $value;
}
add_filter('acf/update_value/type=date_time_picker', 'persca_acf_sanitize_date_time_picker_value', 10, 3);

/**
 * Guarantee 'H:i:s' format in database for time_picker fields.
 *
 * @param mixed $value
 * @param mixed $post_id
 * @param array $field
 * @return mixed
 */
function persca_acf_sanitize_time_picker_value($value, $post_id = 0, $field = null)
{
    if (empty($value) || !is_string($value)) {
        return $value;
    }

    $value = trim($value);

    if (preg_match('/^(\d{2}):(\d{2})$/', $value)) {
        return $value . ':00';
    }

    return $value;
}
add_filter('acf/update_value/type=time_picker', 'persca_acf_sanitize_time_picker_value', 10, 3);
