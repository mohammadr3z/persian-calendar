<?php

/**
 * Admin interface functionality for Persian Calendar plugin.
 *
 * Handles the WordPress admin dashboard integration, settings page,
 * and administrative functionality for the Persian Calendar plugin.
 *
 * @package PERSCA
 * @since 1.0.0
 */

// Prevent direct access
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Admin interface class for Persian Calendar plugin.
 *
 * Manages the WordPress admin dashboard integration including
 * settings page registration, field rendering, and option handling.
 *
 * @since 1.0.0
 */
final class PERSCA_Admin
{
    /**
     * Plugin options key.
     *
     * @var string
     */
    const OPTIONS_KEY = 'persca_options';

    /**
     * Plugin instance.
     *
     * @var PERSCA_Plugin|null
     */
    private $plugin;

    /**
     * Constructor.
     *
     * @param PERSCA_Plugin|null $plugin Plugin instance.
     */
    public function __construct($plugin = null)
    {
        $this->plugin = $plugin;
    }

    /**
     * Initialize admin functionality.
     *
     * @since 1.0.0
     */
    public function init(): void
    {
        add_action('admin_menu', [$this, 'add_settings_page']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_styles']);
    }

    /**
     * Enqueue admin styles.
     *
     * @since 1.0.0
     */
    public function enqueue_admin_styles($hook): void
    {
        if ('settings_page_persian-calendar' !== $hook) {
            return;
        }
        wp_enqueue_style('dashicons');
        wp_enqueue_style(
            'persian-calendar-admin',
            PERSCA_PLUGIN_URL . 'assets/css/admin.css',
            ['dashicons'],
            PERSCA_PLUGIN_VERSION
        );
    }

    /**
     * Add the options page.
     *
     * @since 1.0.0
     */
    public function add_settings_page(): void
    {
        add_options_page(
            __('Persian Calendar Settings', 'persian-calendar'),
            __('Persian Calendar', 'persian-calendar'),
            'manage_options',
            'persian-calendar',
            [$this, 'render_settings_page']
        );
    }

    /**
     * Register the setting, section and fields.
     *
     * @since 1.0.0
     */
    public function register_settings(): void
    {
        register_setting('persca_settings', self::OPTIONS_KEY, [$this, 'sanitize_options']);

        add_settings_section(
            'persca_main',
            __('General Settings', 'persian-calendar'),
            function () {
                echo '<p>' . esc_html__('Configure Persian calendar conversion and Persian digit settings.', 'persian-calendar') . '</p>';
            },
            'persian-calendar'
        );

        // Settings fields are rendered manually in render_settings_fields() method
    }

    /**
     * Sanitize options before saving.
     *
     * @since 1.0.0
     *
     * @param array $input Raw input array.
     * @return array       Cleaned options array.
     */
    public function sanitize_options($input): array
    {
        $defaults = self::get_default_settings();

        // Check user permissions
        if (! current_user_can('manage_options')) {
            add_settings_error(
                self::OPTIONS_KEY,
                'permission_denied',
                __('You do not have permission to change these settings.', 'persian-calendar'),
                'error'
            );
            return $defaults;
        }

        // Validate input is array
        if (! is_array($input)) {
            return $defaults;
        }

        // Verify nonce for security
        if (
            ! isset($_POST['persca_nonce']) ||
            ! wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['persca_nonce'])), 'persca_settings')
        ) {
            add_settings_error(
                self::OPTIONS_KEY,
                'nonce_failed',
                __('Security error: Invalid request.', 'persian-calendar'),
                'error'
            );
            return $defaults;
        }

        $out = [];
        foreach ($defaults as $key => $def) {
            // Sanitize and validate each option
            $value = isset($input[$key]) ? sanitize_key($input[$key]) : '';
            $out[$key] = ! empty($value) ? (bool) $value : false;

            // Force integration options to false if their respective plugins are not active
            if ($key === 'enable_integration_jet_engine' && ! class_exists('Jet_Engine')) {
                $out[$key] = false;
            }
            if ($key === 'enable_integration_jet_form_builder' && ! function_exists('jet_form_builder')) {
                $out[$key] = false;
            }
            if ($key === 'enable_integration_jet_booking' && ! (class_exists('JET_ABAF\\Plugin') || defined('JET_ABAF_VERSION'))) {
                $out[$key] = false;
            }
            if ($key === 'enable_integration_jet_appointments' && ! (class_exists('JET_APB\\Plugin') || defined('JET_APB_VERSION'))) {
                $out[$key] = false;
            }
            if ($key === 'enable_integration_jet_smart_filters' && ! class_exists('Jet_Smart_Filters')) {
                $out[$key] = false;
            }
            if ($key === 'enable_integration_edd' && ! (class_exists('Easy_Digital_Downloads') || function_exists('EDD') || defined('EDD_VERSION'))) {
                $out[$key] = false;
            }
            if ($key === 'enable_integration_woocommerce' && ! (class_exists('WooCommerce') || defined('WC_VERSION'))) {
                $out[$key] = false;
            }
        }

        // Disable Gutenberg calendar if Classic Editor is enabled
        if (! empty($out['enable_classic_editor'])) {
            $out['enable_gutenberg_calendar'] = false;
        }

        // Auto-enable Gutenberg calendar when Classic Editor is turned off
        $previous = get_option(self::OPTIONS_KEY, $defaults);
        if (! empty($previous['enable_classic_editor']) && empty($out['enable_classic_editor'])) {
            $out['enable_gutenberg_calendar'] = true;
        }

        return wp_parse_args($out, $defaults);
    }

    /**
     * Get default settings array (static method for external access).
     *
     * @return array
     */
    public static function get_default_settings(): array
    {
        return [
            'enable_jalali'        => true,
            'enable_persian_digits' => true,
            'regional_settings'    => true,
            'enable_dashboard_font' => true,
            'enable_gutenberg_calendar' => true,
            'enable_classic_editor' => false,
            'enable_integration_jet_engine' => false,
            'enable_integration_jet_form_builder' => false,
            'enable_integration_jet_booking' => false,
            'enable_integration_jet_appointments' => false,
            'enable_integration_jet_smart_filters' => false,
            'enable_integration_edd' => false,
            'enable_integration_woocommerce' => false,
        ];
    }

    /**
     * Render a checkbox field with toggle switch.
     *
     * @since 1.0.0
     *
     * @param array $args Field args: option key and description.
     */
    public function checkbox_field(array $args): void
    {
        // Check user permissions before rendering admin fields
        if (! current_user_can('manage_options')) {
            return;
        }

        $opts = get_option(self::OPTIONS_KEY, self::get_default_settings());
        $opts = wp_parse_args($opts, self::get_default_settings());
        $key  = $args['option'];
        $image = isset($args['image']) ? $args['image'] : '';
        if ($image !== '') {
            $icon = '<img src="' . esc_url(PERSCA_PLUGIN_URL . 'assets/images/' . $image) . '" alt="' . esc_attr(isset($args['label']) ? $args['label'] : '') . '" class="persian-calendar-settings-image" />';
        } else {
            $icon = isset($args['icon']) ? '<span class="dashicons ' . esc_attr($args['icon']) . '"></span>' : '<span class="dashicons dashicons-admin-generic"></span>';
        }
        $label = isset($args['label']) ? $args['label'] : '';

        // Check if this field should be disabled by another field or a custom condition
        $disabled_by = isset($args['disabled_by']) ? $args['disabled_by'] : null;
        $is_disabled = false;
        $disabled_message = '';

        if ($disabled_by) {
            if (isset($disabled_by['active']) && $disabled_by['active']) {
                $is_disabled = true;
                $disabled_message = isset($disabled_by['message']) ? $disabled_by['message'] : '';
            } elseif (isset($disabled_by['option']) && isset($opts[$disabled_by['option']]) && $opts[$disabled_by['option']]) {
                $is_disabled = true;
                $disabled_message = isset($disabled_by['message']) ? $disabled_by['message'] : '';
            }
        }

        $row_class = 'persian-calendar-settings-row';
        if ($is_disabled) {
            $row_class .= ' persian-calendar-row-disabled';
        }

        echo '<div class="' . esc_attr($row_class) . '">';

        if ($is_disabled) {
            $icon = ($image === '') ? '<span class="dashicons dashicons-lock"></span>' : $icon;
        }

        $icon_wrap_class = 'persian-calendar-settings-icon';
        if ($image !== '') {
            $icon_wrap_class .= ' persian-calendar-settings-icon-image';
            if ($is_disabled) {
                $icon_wrap_class .= ' persian-calendar-settings-icon-image-disabled';
            }
        } elseif ($is_disabled) {
            $icon_wrap_class .= ' persian-calendar-settings-icon-disabled';
        }
        echo '<div class="' . esc_attr($icon_wrap_class) . '">' . wp_kses_post($icon) . '</div>';
        echo '<div class="persian-calendar-settings-content">';
        echo '<div class="persian-calendar-settings-title">' . esc_html($label) . '</div>';
        if ($is_disabled) {
            echo '<p class="persian-calendar-settings-description persian-calendar-disabled-warning">' . esc_html($disabled_message) . '</p>';
        } else {
            echo '<p class="persian-calendar-settings-description">' . esc_html($args['desc']) . '</p>';
        }
        echo '</div>'; // Closes persian-calendar-settings-content

        // Always render the control, but add disabled attribute if needed
        echo '<div class="persian-calendar-settings-control">';
        echo '<label class="persian-calendar-toggle' . ($is_disabled ? ' persian-calendar-toggle-disabled' : '') . '">';
        printf(
            '<input type="checkbox" id="%1$s" name="' . esc_attr(self::OPTIONS_KEY) . '[%1$s]" value="1" %2$s %3$s/>',
            esc_attr($key),
            checked(!$is_disabled && ! empty($opts[$key]), true, false),
            $is_disabled ? 'disabled="disabled"' : ''
        );
        echo '<span class="persian-calendar-slider"></span>';
        echo '</label>';
        echo '</div>';

        echo '</div>'; // Closes main row
    }

    /**
     * Render a list of checkbox fields from a field definition array.
     *
     * @param array $fields Map of option key => field data (label, desc, icon, optional disabled_by).
     */
    private function render_fields(array $fields): void
    {
        foreach ($fields as $option => $field_data) {
            $field_args = [
                'label_for' => $option,
                'option'    => $option,
                'label'     => $field_data['label'],
                'desc'      => $field_data['desc'],
                'icon'      => $field_data['icon'],
            ];

            if (isset($field_data['image'])) {
                $field_args['image'] = $field_data['image'];
            }

            if (isset($field_data['disabled_by'])) {
                $field_args['disabled_by'] = $field_data['disabled_by'];
            }

            $this->checkbox_field($field_args);
        }
    }

    /**
     * Render settings fields manually.
     *
     * @since 1.0.0
     */
    private function render_settings_fields(): void
    {
        $fields = [
            'enable_jalali' => [
                'label' => __('Jalali Calendar', 'persian-calendar'),
                'desc' => __('Activate Persian/Jalali calendar system throughout your entire website.', 'persian-calendar'),
                'icon' => 'dashicons-calendar-alt',
            ],
            'regional_settings' => [
                'label' => __('Regional Settings', 'persian-calendar'),
                'desc' => __('Configure website timezone to Iran and set Saturday as the first day of the week.', 'persian-calendar'),
                'icon' => 'dashicons-admin-site-alt3',
            ],
            'enable_persian_digits' => [
                'label' => __('Persian Digits', 'persian-calendar'),
                'desc' => __('Transform English numerals to Persian digits in all date displays.', 'persian-calendar'),
                'icon' => 'dashicons-editor-ol',
            ],
            'enable_gutenberg_calendar' => [
                'label' => __('Gutenberg Calendar', 'persian-calendar'),
                'desc' => __('Integrate Persian calendar functionality within the Gutenberg editor.', 'persian-calendar'),
                'icon' => 'dashicons-edit',
                'disabled_by' => [
                    'option'  => 'enable_classic_editor',
                    'message' => __('Since the Classic Editor is active, the Gutenberg editor and its calendar integration are disabled.', 'persian-calendar'),
                ],
            ],
            'enable_classic_editor' => [
                'label' => __('Classic Editor', 'persian-calendar'),
                'desc' => __('Enable classic editor instead of block editor (Gutenberg).', 'persian-calendar'),
                'icon' => 'dashicons-editor-removeformatting',
            ],
            'enable_dashboard_font' => [
                'label' => __('Dashboard Font', 'persian-calendar'),
                'desc' => __('Apply elegant Persian typography to enhance WordPress dashboard readability.', 'persian-calendar'),
                'icon' => 'dashicons-editor-textcolor',
            ],
        ];

        $this->render_fields($fields);
    }

    /**
     * Render integration settings fields.
     *
     * @since 1.2.7
     */
    private function render_integration_fields(): void
    {
        $jet_engine_active = class_exists('Jet_Engine');
        $jet_form_builder_active = function_exists('jet_form_builder');
        $jet_booking_active = class_exists('JET_ABAF\\Plugin') || defined('JET_ABAF_VERSION');
        $jet_appointments_active = class_exists('JET_APB\\Plugin') || defined('JET_APB_VERSION');
        $jet_smart_filters_active = class_exists('Jet_Smart_Filters');
        $edd_active = class_exists('Easy_Digital_Downloads') || function_exists('EDD') || defined('EDD_VERSION');
        $woocommerce_active = class_exists('WooCommerce') || defined('WC_VERSION');

        $fields = [
            'enable_integration_jet_engine' => [
                'label' => __('JetEngine Integration', 'persian-calendar'),
                'desc' => __('Enable Persian/Jalali calendar and date picker support in JetEngine fields.', 'persian-calendar'),
                'icon' => 'dashicons-admin-plugins',
                'image' => 'jet-engine.png',
                'disabled_by' => !$jet_engine_active ? [
                    'active'  => true,
                    'message' => __('To use this integration, JetEngine plugin must be installed and active.', 'persian-calendar'),
                ] : null,
            ],
            'enable_integration_jet_form_builder' => [
                'label' => __('JetFormBuilder Integration', 'persian-calendar'),
                'desc' => __('Enable Persian/Jalali calendar and date picker support in JetFormBuilder forms.', 'persian-calendar'),
                'icon' => 'dashicons-feedback',
                'image' => 'jet-form-builder.png',
                'disabled_by' => !$jet_form_builder_active ? [
                    'active'  => true,
                    'message' => __('To use this integration, JetFormBuilder plugin must be installed and active.', 'persian-calendar'),
                ] : null,
            ],
            'enable_integration_jet_booking' => [
                'label' => __('JetBooking Integration', 'persian-calendar'),
                'desc' => __('Enable Persian/Jalali calendar and date picker support in JetBooking check-in/out fields and admin panels.', 'persian-calendar'),
                'icon' => 'dashicons-building',
                'image' => 'jet-booking.png',
                'disabled_by' => !$jet_booking_active ? [
                    'active'  => true,
                    'message' => __('To use this integration, JetBooking plugin must be installed and active.', 'persian-calendar'),
                ] : null,
            ],
            'enable_integration_jet_appointments' => [
                'label' => __('JetAppointments Booking Integration', 'persian-calendar'),
                'desc' => __('Enable Persian/Jalali calendar and date picker support in JetAppointments booking forms, time slots, and admin panels.', 'persian-calendar'),
                'icon' => 'dashicons-calendar-alt',
                'image' => 'jet-appointments.png',
                'disabled_by' => !$jet_appointments_active ? [
                    'active'  => true,
                    'message' => __('To use this integration, JetAppointments Booking plugin must be installed and active.', 'persian-calendar'),
                ] : null,
            ],
            'enable_integration_jet_smart_filters' => [
                'label' => __('JetSmartFilters Integration', 'persian-calendar'),
                'desc' => __('Enable Persian/Jalali calendar and date picker support in JetSmartFilters widgets and blocks.', 'persian-calendar'),
                'icon' => 'dashicons-filter',
                'image' => 'jet-smart-filters.png',
                'disabled_by' => !$jet_smart_filters_active ? [
                    'active'  => true,
                    'message' => __('To use this integration, JetSmartFilters plugin must be installed and active.', 'persian-calendar'),
                ] : null,
            ],
            'enable_integration_edd' => [
                'label' => __('Easy Digital Downloads Integration', 'persian-calendar'),
                'desc' => __('Enable Persian/Jalali calendar and date picker support in Easy Digital Downloads discounts, orders, customers, and reports', 'persian-calendar'),
                'icon' => 'dashicons-cart',
                'image' => 'edd.png',
                'disabled_by' => !$edd_active ? [
                    'active'  => true,
                    'message' => __('To use this integration, Easy Digital Downloads plugin must be installed and active.', 'persian-calendar'),
                ] : null,
            ],
            'enable_integration_woocommerce' => [
                'label' => __('WooCommerce Integration', 'persian-calendar'),
                'desc' => __('Enable Persian/Jalali calendar and date picker support in WooCommerce orders, coupons, product sale schedules, downloads, and report charts.', 'persian-calendar'),
                'icon' => 'dashicons-store',
                'image' => 'woocommerce.png',
                'disabled_by' => !$woocommerce_active ? [
                    'active'  => true,
                    'message' => __('To use this integration, WooCommerce plugin must be installed and active.', 'persian-calendar'),
                ] : null,
            ],
        ];

        $this->render_fields($fields);
    }

    /**
     * Render the settings page.
     *
     * @since 1.0.0
     */
    public function render_settings_page(): void
    {
        if (! current_user_can('manage_options')) {
            return;
        }
?>
        <div class="persian-calendar-settings">
            <!-- Header -->
            <div class="persian-calendar-header">
                <div class="persian-calendar-header-main">
                    <div class="persian-calendar-header-title">
                        <h4><?php esc_html_e('Persian Calendar Settings', 'persian-calendar'); ?></h4>
                        <p><?php esc_html_e('Configure Persian calendar and digit conversion settings for your WordPress website', 'persian-calendar'); ?></p>
                    </div>
                    <div class="persian-calendar-version">
                        <?php printf(esc_html__('Version %s', 'persian-calendar'), PERSCA_PLUGIN_VERSION); ?>
                    </div>
                </div>
                <div class="persian-calendar-logo">
                    <img src="<?php echo esc_url(PERSCA_PLUGIN_URL . 'assets/images/icon.png'); ?>" alt="Persian Calendar Logo">
                </div>
            </div>

            <!-- Main Content -->
            <div class="persian-calendar-main">
                <!-- Content -->
                <div class="persian-calendar-content">
                    <form id="persian-calendar-form" method="post" action="options.php">
                        <?php
                        settings_fields('persca_settings');
                        wp_nonce_field('persca_settings', 'persca_nonce');
                        ?>

                        <div class="persian-calendar-card">
                            <div class="persian-calendar-card-header">
                                <h4><?php esc_html_e('General Settings', 'persian-calendar'); ?></h4>
                            </div>
                            <div class="persian-calendar-card-body">
                                <?php $this->render_settings_fields(); ?>
                            </div>
                        </div>

                        <div class="persian-calendar-card">
                            <div class="persian-calendar-card-header">
                                <h4><?php esc_html_e('Integrations', 'persian-calendar'); ?></h4>
                            </div>
                            <div class="persian-calendar-card-body">
                                <?php $this->render_integration_fields(); ?>
                            </div>
                        </div>

                        <button type="submit" class="persian-calendar-submit">
                            <?php esc_html_e('Save Changes', 'persian-calendar'); ?>
                        </button>
                    </form>
                </div>

                <!-- Sidebar -->
                <div class="persian-calendar-sidebar">
                    <!-- About Plugin -->
                    <div class="persian-calendar-about">
                        <div class="persian-calendar-about-header">
                        </div>
                        <p><?php esc_html_e('The Persian Calendar plugin automatically converts all WordPress Gregorian dates to Jalali (Persian) dates across your entire website.', 'persian-calendar'); ?></p>
                    </div>

                    <!-- Premium Ad -->
                    <div class="persian-calendar-premium-ad">
                        <div class="premium-ad-content">
                            <h5><?php esc_html_e('Need Advanced Features?', 'persian-calendar'); ?></h5>
                            <p><?php esc_html_e('Unlock advanced Persian calendar features and receive premium support.', 'persian-calendar'); ?></p>
                            <a href="<?php echo esc_url('#'); ?>" class="premium-ad-button"><?php esc_html_e('Learn More', 'persian-calendar'); ?></a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
<?php
    }
}
