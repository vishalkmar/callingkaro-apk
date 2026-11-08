import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  AppText,
  Avatar,
  EmptyState,
  Icon,
  ListItem,
  ROW_HEIGHT,
  SectionHeader,
  SECTION_HEADER_HEIGHT,
  SkeletonList,
  toast,
} from '@components/common';
import { colors, spacing, typography, FONT_SCALE } from '@theme';
import { ROUTES } from '@constants/routes';
import { t } from '@i18n';
import { usePermission } from '@hooks/usePermission';
import * as favoritesRepo from '@db/favoritesRepo';
import { on, DB_EVENTS } from '@db/events';
import { syncFromPhone, loadCached, buildSections, titleOf, filterContacts } from '@services/contacts/contactsService';
import { placeCall } from '@services/calls/placeCall';
import { formatPhone } from '@utils/format';
import ContactSheet from './ContactSheet';
import AlphabetIndex from './AlphabetIndex';

const FAV_ROW_HEIGHT = 92;

/** Image 5: search bar with orange icon, favorites row, A-Z sections with orange underline, fast scroll. */
const ContactsScreen = () => {
  const navigation = useNavigation();
  const perm = usePermission('contacts');
  const [contacts, setContacts] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(null);
  const listRef = useRef(null);

  // Instant: cached copy first, then a fresh read from the phone in the background.
  const load = useCallback(async () => {
    try {
      setContacts(await loadCached());
    } catch (e) {
      setContacts([]); // never leave the skeleton spinning; pull-to-refresh can retry
    }
    const fresh = await syncFromPhone();
    if (fresh) {
      setContacts(await loadCached().catch(() => fresh));
    }
  }, []);

  useEffect(() => {
    if (perm.granted) {
      load();
    }
  }, [perm.granted, load]);

  const loadFavorites = useCallback(async () => setFavorites(await favoritesRepo.list()), []);
  useEffect(() => {
    loadFavorites();
    return on(DB_EVENTS.FAVORITES, loadFavorites);
  }, [loadFavorites]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim().toLowerCase()), 200);
    return () => clearTimeout(id);
  }, [query]);

  const filtered = useMemo(() => {
    if (!contacts) {
      return [];
    }
    return filterContacts(contacts, debounced);
  }, [contacts, debounced]);

  const { items, letters } = useMemo(() => buildSections(filtered), [filtered]);
  const favoriteSet = useMemo(() => new Set(favorites.map(f => f.number)), [favorites]);
  const showFavorites = favorites.length > 0 && !debounced;

  // Fixed heights -> getItemLayout for smooth scrolling with 1000+ contacts.
  const offsets = useMemo(() => {
    const arr = [];
    let y = showFavorites ? FAV_ROW_HEIGHT : 0;
    for (const it of items) {
      const h = it.type === 'header' ? SECTION_HEADER_HEIGHT : ROW_HEIGHT;
      arr.push({ length: h, offset: y });
      y += h;
    }
    return arr;
  }, [items, showFavorites]);

  const stickyHeaders = useMemo(
    () => items.map((it, i) => (it.type === 'header' ? i : -1)).filter(i => i >= 0),
    [items],
  );

  const getItemLayout = useCallback((_, index) => ({ ...offsets[index], index }), [offsets]);

  const jumpTo = useCallback(
    letter => {
      const index = items.findIndex(it => it.type === 'header' && it.title === letter);
      if (index >= 0) {
        listRef.current?.scrollToIndex({ index, animated: false });
      }
    },
    [items],
  );

  const toggleFavorite = useCallback(async (number, name) => {
    const nowFav = await favoritesRepo.toggle(number, name);
    toast.success(nowFav ? t('contacts.addedFav') : t('contacts.removedFav'), name || number);
  }, []);

  const call = useCallback((number, name) => {
    setSheet(null);
    placeCall({ number, name });
  }, []);

  const renderItem = useCallback(
    ({ item }) => {
      if (item.type === 'header') {
        return <SectionHeader title={item.title} />;
      }
      const c = item.contact;
      const primary = c.numbers[0]?.e164;
      return (
        <ListItem
          title={titleOf(c)}
          subtitle={
            c.name ? formatPhone(primary) + (c.numbers.length > 1 ? `  +${c.numbers.length - 1}` : '') : undefined
          }
          avatarName={c.name}
          avatarUri={c.thumbnail}
          onPress={() => setSheet(c)}
          onLongPress={() => toggleFavorite(primary, c.name)}
          right={
            favoriteSet.has(primary) ? <Icon name="star" size={18} color={colors.primary} style={styles.star} /> : null
          }
          accessibilityLabel={`${titleOf(c)}. Tap for numbers, long press to favorite`}
        />
      );
    },
    [favoriteSet, toggleFavorite],
  );

  const favoritesRow = showFavorites ? (
    <View style={styles.favWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favRow}>
        {favorites.map(f => (
          <Pressable android_ripple={{ color: colors.surfaceAlt, borderless: true }}
            key={f.number}
            style={styles.fav}
            onPress={() => placeCall({ number: f.number, name: f.name })}
            onLongPress={() => toggleFavorite(f.number, f.name)}
            accessibilityRole="button"
            accessibilityLabel={`Call favorite ${f.name || f.number}`}>
            <Avatar name={f.name} size={48} />
            <AppText variant="caption" numberOfLines={1} style={styles.favName}>
              {f.name || f.number.slice(-10)}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  ) : null;

  if (perm.status && !perm.granted) {
    return (
      <EmptyState
        icon="card-account-phone-outline"
        message={t('contacts.noAccess')}
        linkText={t('contacts.accessLink')}
        onLinkPress={() => (perm.blocked ? perm.openSettings() : perm.request())}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.search}>
        <TextInput
          maxFontSizeMultiplier={FONT_SCALE.max}
          value={query}
          onChangeText={setQuery}
          placeholder={t('contacts.search')}
          placeholderTextColor={colors.subtext}
          style={styles.searchInput}
          accessibilityLabel="Search contacts"
          returnKeyType="search"
        />
        {query ? (
          <Pressable android_ripple={{ color: colors.surfaceAlt, borderless: true }} onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
            <Icon name="close" size={20} color={colors.subtext} />
          </Pressable>
        ) : (
          <Icon name="magnify" size={22} color={colors.primary} />
        )}
      </View>
      {contacts === null ? (
        <SkeletonList rows={8} />
      ) : (
        <View style={styles.flex}>
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={it => it.key}
            renderItem={renderItem}
            getItemLayout={getItemLayout}
            stickyHeaderIndices={showFavorites ? undefined : stickyHeaders}
            ListHeaderComponent={favoritesRow}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={11}
            removeClippedSubviews
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                colors={[colors.primary]}
                onRefresh={async () => {
                  setRefreshing(true);
                  await syncFromPhone();
                  setContacts(await loadCached());
                  setRefreshing(false);
                }}
              />
            }
            ListEmptyComponent={<EmptyState icon="account-search-outline" message={t('contacts.noResults')} />}
            contentContainerStyle={items.length ? undefined : styles.flexGrow}
          />
          {!debounced ? <AlphabetIndex letters={letters} onLetter={jumpTo} /> : null}
        </View>
      )}
      <ContactSheet
        contact={sheet}
        visible={!!sheet}
        onClose={() => setSheet(null)}
        onCall={call}
        onDial={number => {
          setSheet(null);
          navigation.navigate(ROUTES.DIALPAD, { prefill: number });
        }}
        onToggleFavorite={toggleFavorite}
        favoriteNumbers={favoriteSet}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  flexGrow: { flexGrow: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    minHeight: 48,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.xs },
  star: { marginRight: spacing.lg },
  favWrap: { height: FAV_ROW_HEIGHT, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  favRow: { paddingHorizontal: spacing.sm, alignItems: 'center' },
  fav: { width: 68, alignItems: 'center', paddingVertical: spacing.xs },
  favName: { marginTop: spacing.xxs, maxWidth: 64 },
});

export default ContactsScreen;
